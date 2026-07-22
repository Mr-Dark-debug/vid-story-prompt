import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { basename, extname, join, relative, resolve } from "node:path";
import { spawn } from "node:child_process";

export type SourceSection = { startSeconds: number; endSeconds: number };

export function buildLocalYtdlpArgs(input: {
  videoId: string;
  directory: string;
  maximumBytes: number;
  expectedDurationSeconds: number;
  section?: SourceSection | null;
  cookiesPath?: string;
}) {
  if (!/^[A-Za-z0-9_-]{11}$/.test(input.videoId)) throw new Error("Invalid YouTube video ID.");
  if (!Number.isFinite(input.maximumBytes) || input.maximumBytes <= 0)
    throw new Error("Invalid byte limit.");
  if (!Number.isFinite(input.expectedDurationSeconds) || input.expectedDurationSeconds <= 0) {
    throw new Error("Invalid duration limit.");
  }
  const args = [
    "--no-playlist",
    "--no-overwrites",
    "--restrict-filenames",
    "--no-progress",
    "--no-part",
    "--ignore-config",
    "--no-cache-dir",
    "--force-ipv4",
    "--retries",
    "3",
    "--fragment-retries",
    "3",
    "--max-filesize",
    String(input.maximumBytes),
    "--match-filters",
    `!is_live & duration <= ${Math.ceil(input.expectedDurationSeconds * 1.05 + 5)}`,
    "-f",
    "bestvideo[height<=1080]+bestaudio/best[height<=1080]/best",
    "--merge-output-format",
    "mp4",
    "--remux-video",
    "mp4",
    "-o",
    join(input.directory, "source.%(ext)s"),
  ];
  if (input.cookiesPath) args.push("--cookies", resolve(input.cookiesPath));
  else args.push("--no-cookies");
  if (input.section) {
    if (
      input.section.startSeconds < 0 ||
      input.section.endSeconds <= input.section.startSeconds ||
      input.section.endSeconds > input.expectedDurationSeconds
    ) {
      throw new Error("Invalid source section.");
    }
    args.push(
      "--downloader",
      "ffmpeg",
      "--download-sections",
      `*${input.section.startSeconds}-${input.section.endSeconds}`,
    );
  }
  args.push(`https://www.youtube.com/watch?v=${input.videoId}`);
  return args;
}

function run(command: string, args: string[], signal?: AbortSignal) {
  return new Promise<void>((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"], signal });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      if (stderr.length < 8_192) stderr += String(chunk).slice(0, 8_192 - stderr.length);
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(classifyLocalFailure(stderr)));
    });
  });
}

function classifyLocalFailure(stderr: string) {
  const value = stderr.toLowerCase();
  if (value.includes("private video")) return "This video is private.";
  if (value.includes("age-restricted")) return "This video is age-restricted.";
  if (value.includes("sign in to confirm") || value.includes("not a bot")) {
    return "YouTube challenged this local request. Optional local cookies may be required.";
  }
  if (value.includes("not found") || value.includes("is not recognized")) {
    return "yt-dlp or FFmpeg is not installed on this device.";
  }
  return "The local YouTube acquisition failed.";
}

export async function acquireLocalSource(
  input: Parameters<typeof buildLocalYtdlpArgs>[0] & { signal?: AbortSignal },
) {
  await run(process.env.YTDLP_PATH ?? "yt-dlp", buildLocalYtdlpArgs(input), input.signal);
  const files = (await readdir(input.directory)).filter((name) => name.startsWith("source."));
  if (files.length !== 1) throw new Error("yt-dlp did not produce one isolated source file.");
  const filename = resolve(input.directory, files[0]);
  const contained = relative(resolve(input.directory), filename);
  if (contained.startsWith("..") || contained === "") throw new Error("Invalid output path.");
  const info = await stat(filename);
  if (!info.isFile() || info.size <= 0 || info.size > input.maximumBytes) {
    throw new Error("The local source exceeded its allowed size.");
  }
  const extension = extname(filename).toLowerCase();
  if (extension !== ".mp4") {
    throw new Error("The local source format is unsupported.");
  }
  return { filename, bytes: info.size, displayName: basename(filename) };
}

export async function sha256File(filename: string) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filename)) hash.update(chunk as Buffer);
  return hash.digest("hex");
}
