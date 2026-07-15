import { z } from "zod";

const optionalSecret = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(10).optional(),
);
export const env = z
  .object({
    SUPABASE_URL: z.string().url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
    WORKER_ID: z.string().min(1).default(`worker-${process.pid}`),
    PORT: z.coerce.number().int().positive().default(8080),
    WORKER_WAKE_SECRET: optionalSecret,
    QUEUE_POLL_INTERVAL_MS: z.coerce.number().int().min(100).default(1000),
    TASK_VISIBILITY_TIMEOUT_SECONDS: z.coerce.number().int().min(30).default(120),
    WORKER_TEMP_ROOT: z.string().default("/tmp/vidrial"),
    FFMPEG_PATH: z.string().default("ffmpeg"),
    FFPROBE_PATH: z.string().default("ffprobe"),
    FFMPEG_THREADS: z.coerce.number().int().min(1).max(8).default(1),
    MAX_DIRECT_DOWNLOAD_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .default(10 * 1024 ** 3),
    DIRECT_DOWNLOAD_CONNECT_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
    DIRECT_DOWNLOAD_READ_TIMEOUT_MS: z.coerce.number().int().positive().default(300_000),
    DIRECT_DOWNLOAD_REDIRECT_LIMIT: z.coerce.number().int().min(0).max(8).default(4),
    YTDLP_TIMEOUT_MS: z.coerce.number().int().positive().default(600_000),
    GROQ_API_KEY: optionalSecret,
    GROQ_TRANSCRIPTION_MODEL: z.string().default("whisper-large-v3-turbo"),
    OPENAI_API_KEY: optionalSecret,
    OPENAI_TRANSCRIPTION_MODEL: z.string().default("gpt-4o-mini-transcribe"),
    OPENROUTER_API_KEY: optionalSecret,
    OPENROUTER_CLIP_MODEL: optionalSecret,
    GOOGLE_CLIENT_ID: optionalSecret,
    GOOGLE_CLIENT_SECRET: optionalSecret,
    GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().min(32).optional(),
    ),
    CONNECTOR_TOKEN_ENCRYPTION_KEY: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().min(32).optional(),
    ),
    CLAMAV_PATH: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().min(1).optional(),
    ),
    VIRUS_SCAN_REQUIRED: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    LOG_LEVEL: z.string().default("info"),
  })
  .parse(process.env);
