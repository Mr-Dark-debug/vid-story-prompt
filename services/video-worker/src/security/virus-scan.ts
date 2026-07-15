import { execa } from "execa";
import { env } from "../config/env.js";
import { TaskFailure } from "../domain/types.js";

export type VirusScanResult =
  { status: "clean"; engine: "clamav" } | { status: "not_configured"; engine: null };

/**
 * Scans a worker-local file before media probing or durable upload.
 * ClamAV returns 0 for clean, 1 for infected, and >1 for scanner errors.
 */
export async function scanLocalFile(path: string): Promise<VirusScanResult> {
  if (!env.CLAMAV_PATH) {
    if (env.VIRUS_SCAN_REQUIRED)
      throw new TaskFailure(
        "virus_scanner_unavailable",
        "A virus scan is required, but the worker scanner is not configured.",
        true,
      );
    return { status: "not_configured", engine: null };
  }

  const result = await execa(env.CLAMAV_PATH, ["--no-summary", path], {
    timeout: 10 * 60_000,
    reject: false,
  });
  if (result.exitCode === 1)
    throw new TaskFailure(
      "malware_detected",
      "The imported media did not pass the malware scan.",
      false,
    );
  if (result.exitCode !== 0)
    throw new TaskFailure(
      "virus_scan_failed",
      "The malware scanner could not verify the imported media.",
      true,
    );
  return { status: "clean", engine: "clamav" };
}
