import { createWriteStream } from "node:fs";
import { lookup } from "node:dns/promises";
import { get } from "node:https";
import { isIP } from "node:net";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import { env } from "../config/env.js";
import { TaskFailure } from "../domain/types.js";
import { isForbiddenAddress } from "./addresses.js";
export { isForbiddenAddress } from "./addresses.js";

async function resolvePublic(hostname: string) { if (isIP(hostname) && isForbiddenAddress(hostname)) throw new TaskFailure("ssrf_blocked", "The direct media URL resolves to a private or reserved address.", false); const addresses = await lookup(hostname, { all: true, verbatim: true }); if (!addresses.length || addresses.some(({ address }) => isForbiddenAddress(address))) throw new TaskFailure("ssrf_blocked", "The direct media URL resolves to a private or reserved address.", false); return addresses[0]; }
export async function downloadDirectMedia(input: string, destination: string, redirects = 0): Promise<{ bytes: number; finalUrl: string }> {
  let url: URL; try { url = new URL(input); } catch { throw new TaskFailure("invalid_url", "The direct media URL is malformed.", false); }
  if (url.protocol !== "https:" || url.username || url.password) throw new TaskFailure("invalid_url", "Direct media URLs must use HTTPS and cannot contain credentials.", false);
  const resolved = await resolvePublic(url.hostname);
  const response = await new Promise<import("node:http").IncomingMessage>((resolve, reject) => { const request = get(url, { timeout: env.DIRECT_DOWNLOAD_CONNECT_TIMEOUT_MS, lookup: (_host,_options,callback) => callback(null,resolved.address,resolved.family) }, resolve); request.on("timeout", () => request.destroy(new Error("connect_timeout"))); request.on("error", reject); });
  if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) { response.resume(); if (redirects >= env.DIRECT_DOWNLOAD_REDIRECT_LIMIT) throw new TaskFailure("redirect_limit", "The media URL exceeded the redirect limit.", false); return downloadDirectMedia(new URL(response.headers.location,url).toString(),destination,redirects+1); }
  if (response.statusCode !== 200) { response.resume(); throw new TaskFailure("download_failed", `Media server returned ${response.statusCode ?? "no status"}.`, response.statusCode ? response.statusCode >= 500 : true); }
  const declared = Number(response.headers["content-length"] ?? 0); if (declared > env.MAX_DIRECT_DOWNLOAD_BYTES) { response.destroy(); throw new TaskFailure("file_too_large", "The direct media file exceeds the configured maximum.", false); }
  let bytes = 0; const limiter = new Transform({ transform(chunk: Buffer, _encoding, callback) { bytes += chunk.length; if (bytes > env.MAX_DIRECT_DOWNLOAD_BYTES) callback(new TaskFailure("file_too_large","The streamed media exceeded the configured maximum.",false)); else callback(null,chunk); } });
  response.setTimeout(env.DIRECT_DOWNLOAD_READ_TIMEOUT_MS, () => response.destroy(new Error("read_timeout")));
  await pipeline(response,limiter,createWriteStream(destination,{ flags:"wx" }));
  if (declared && bytes !== declared) throw new TaskFailure("content_length_mismatch", "The media response ended before its declared length.", true);
  return { bytes, finalUrl: url.toString() };
}
