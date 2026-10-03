import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile, chmod } from "node:fs/promises";
import { join, resolve } from "node:path";
import { execa } from "execa";
import { HARD_LIMITS, validateSpec, type RenderSpec } from "./limits.js";

export type SandboxConfig = {
  image: string;
  tempRoot: string;
  dockerPath: string;
  seccompProfile: string;
  memoryMb: number;
  cpus: number;
  pids: number;
  timeoutMs: number;
};

/** Paths, image and resource limits are operator configuration, never request data. */
export function sandboxArguments(
  config: SandboxConfig,
  name: string,
  input: string,
  output: string,
) {
  if (
    !/^vidrial-motion-[0-9a-f-]{36}$/.test(name) ||
    !/^[a-zA-Z0-9][a-zA-Z0-9/_.:@-]{1,180}$/.test(config.image)
  )
    throw new Error("motion_sandbox_config_invalid");
  if (
    !Number.isInteger(config.memoryMb) ||
    config.memoryMb < 256 ||
    config.memoryMb > 2048 ||
    !Number.isFinite(config.cpus) ||
    config.cpus < 0.25 ||
    config.cpus > 4 ||
    !Number.isInteger(config.pids) ||
    config.pids < 128 ||
    config.pids > 512 ||
    !Number.isInteger(config.timeoutMs) ||
    config.timeoutMs < 10_000 ||
    config.timeoutMs > HARD_LIMITS.totalTimeoutMs ||
    !config.seccompProfile
  )
    throw new Error("motion_sandbox_config_invalid");
  if ([input, output, config.seccompProfile].some((path) => /[\r\n,]/.test(path)))
    throw new Error("motion_sandbox_path_invalid");
  return [
    "run",
    "--rm",
    "--init",
    "--name",
    name,
    "--network=none",
    "--read-only",
    "--user=10001:10001",
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges",
    `--security-opt=seccomp=${resolve(config.seccompProfile)}`,
    `--memory=${config.memoryMb}m`,
    `--memory-swap=${config.memoryMb}m`,
    `--cpus=${config.cpus}`,
    `--pids-limit=${config.pids}`,
    "--ulimit",
    "fsize=134217728:134217728",
    "--ulimit",
    "nofile=512:512",
    "--ipc=private",
    "--shm-size=64m",
    "--tmpfs",
    "/tmp:rw,noexec,nosuid,size=256m,uid=10001,gid=10001",
    "--mount",
    `type=bind,source=${resolve(input)},target=/input,readonly`,
    "--mount",
    `type=bind,source=${resolve(output)},target=/output`,
    config.image,
  ];
}

/** Completion happens while the private directory exists, then cleanup is unconditional. */
export async function withSandboxRender<T>(
  source: string,
  spec: RenderSpec,
  watermark: boolean,
  config: SandboxConfig,
  consume: (result: {
    output: string;
    poster: string;
    manifest: Record<string, unknown>;
  }) => Promise<T>,
  signal?: AbortSignal,
  mode: "render" | "keyframes" = "render",
  onProgress?: (progress: number) => void,
) {
  signal?.throwIfAborted();
  validateSpec(spec);
  if (Buffer.byteLength(source) > HARD_LIMITS.sourceBytes)
    throw new Error("motion_source_over_limit");
  const directory = await mkdtemp(join(config.tempRoot, "motion-"));
  const name = `vidrial-motion-${randomUUID()}`;
  try {
    const input = join(directory, "input"),
      output = join(directory, "output");
    await mkdir(input);
    await mkdir(output);
    await chmod(directory, 0o755);
    await chmod(input, 0o755);
    await chmod(output, 0o777);
    await writeFile(join(input, "scene.html"), source, { mode: 0o444, flag: "wx" });
    await writeFile(
      join(input, "spec.json"),
      JSON.stringify({ ...spec, watermarked: watermark, mode }),
      { mode: 0o444, flag: "wx" },
    );
    const process = execa(config.dockerPath, sandboxArguments(config, name, input, output), {
      timeout: config.timeoutMs,
      cancelSignal: signal,
      reject: false,
      maxBuffer: 4096,
      windowsHide: true,
    });
    let pending = "";
    process.stdout?.on("data", (chunk: Buffer) => {
      pending += chunk.toString("utf8");
      if (pending.length > 4096) {
        pending = "";
        return;
      }
      let end: number;
      while ((end = pending.indexOf("\n")) >= 0) {
        const line = pending.slice(0, end);
        pending = pending.slice(end + 1);
        try {
          const message = JSON.parse(line) as { motionProgress?: unknown };
          if (
            typeof message.motionProgress === "number" &&
            Number.isFinite(message.motionProgress) &&
            message.motionProgress >= 0 &&
            message.motionProgress <= 1
          )
            onProgress?.(message.motionProgress);
        } catch {
          /* Progress is advisory; only the manifest determines success. */
        }
      }
    });
    const result = await process;
    if (result.exitCode !== 0) {
      const code = result.stderr.trim();
      throw new Error(/^motion_[a-z_]+$/.test(code) ? code : "motion_sandbox_failed");
    }
    const manifest = JSON.parse(await readFile(join(output, "manifest.json"), "utf8")) as Record<
      string,
      unknown
    >;
    return await consume({
      output: join(output, "output.mp4"),
      poster: join(output, "poster.png"),
      manifest,
    });
  } finally {
    // Killing the CLI does not guarantee its Docker container died. Force-remove by generated name.
    await execa(config.dockerPath, ["rm", "-f", name], {
      timeout: 10_000,
      reject: false,
      maxBuffer: 4096,
      windowsHide: true,
    }).catch(() => undefined);
    await rm(directory, { recursive: true, force: true });
  }
}

export function withSandboxKeyframes(
  source: string,
  spec: RenderSpec,
  config: SandboxConfig,
  signal: AbortSignal,
) {
  return withSandboxRender(
    source,
    spec,
    false,
    config,
    async ({ output }) => {
      const directory = resolve(output, "..");
      const frames: Buffer[] = [];
      for (let index = 0; index < 4; index++) {
        const frame = await readFile(join(directory, `keyframe-${index}.png`));
        if (frame.length > 2_000_000) throw new Error("motion_critique_frames_over_limit");
        frames.push(frame);
      }
      return frames;
    },
    signal,
    "keyframes",
  );
}
