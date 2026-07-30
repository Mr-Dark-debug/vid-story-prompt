import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const webhookSchema = z.object({
  event_id: z.string().min(8).max(300),
  request_id: z.string().min(16).max(160).regex(/^[A-Za-z0-9_-]+$/),
  job_id: z.string().uuid(),
  task_id: z.string().uuid(),
  state: z.enum([
    "accepted",
    "extracting",
    "downloading",
    "postprocessing",
    "completed",
    "failed",
    "cancelled",
  ]),
  progress_current: z.number().int().nonnegative().nullable().optional(),
  progress_total: z.number().int().positive().nullable().optional(),
});

export type PythonAcquisitionWebhook = z.infer<typeof webhookSchema>;

export function verifyPythonAcquisitionWebhook(
  body: Buffer,
  signature: string | undefined,
  secret: string,
): PythonAcquisitionWebhook {
  if (!signature?.startsWith("sha256=")) throw new Error("invalid_signature");
  const providedHex = signature.slice("sha256=".length);
  if (!/^[a-f0-9]{64}$/.test(providedHex)) throw new Error("invalid_signature");
  const provided = Buffer.from(providedHex, "hex");
  const expected = createHmac("sha256", secret).update(body).digest();
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw new Error("invalid_signature");
  }
  return webhookSchema.parse(JSON.parse(body.toString("utf8")));
}

export const pythonAcquisitionEventCopy: Record<
  PythonAcquisitionWebhook["state"],
  { severity: "info" | "warning" | "error"; message: string }
> = {
  accepted: { severity: "info", message: "The protected Python acquisition engine accepted this source." },
  extracting: { severity: "info", message: "Reading the authorised YouTube source metadata." },
  downloading: { severity: "info", message: "Downloading the plan-capped source through protected egress." },
  postprocessing: { severity: "info", message: "Finalising the partial source media with FFmpeg." },
  completed: { severity: "info", message: "The protected source download completed and is being validated." },
  failed: { severity: "warning", message: "This protected acquisition path was blocked; the worker will try the next configured path." },
  cancelled: { severity: "warning", message: "The protected source download was cancelled." },
};
