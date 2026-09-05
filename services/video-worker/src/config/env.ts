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
    WORKER_TASK_INCLUDE_TYPES: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().optional(),
    ),
    WORKER_TASK_EXCLUDE_TYPES: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().optional(),
    ),
    WORKER_CONNECTOR_TASKS_ENABLED: z
      .enum(["true", "false"])
      .default("true")
      .transform((value) => value === "true"),
    WORKER_TEMP_ROOT: z.string().default("/tmp/vidrial"),
    CURL_PATH: z.string().min(1).default("curl"),
    FFMPEG_PATH: z.string().default("ffmpeg"),
    FFPROBE_PATH: z.string().default("ffprobe"),
    FFMPEG_THREADS: z.coerce.number().int().min(1).max(8).default(1),
    MAX_DIRECT_DOWNLOAD_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .default(10 * 1024 ** 3),
    STORAGE_UPLOAD_CHUNK_BYTES: z.coerce
      .number()
      .int()
      .min(5 * 1024 ** 2)
      .max(48 * 1024 ** 2)
      .default(45 * 1024 ** 2),
    DIRECT_DOWNLOAD_CONNECT_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
    DIRECT_DOWNLOAD_READ_TIMEOUT_MS: z.coerce.number().int().positive().default(300_000),
    DIRECT_DOWNLOAD_REDIRECT_LIMIT: z.coerce.number().int().min(0).max(8).default(4),
    YTDLP_PATH: z.string().min(1).default("yt-dlp"),
    YTDLP_TIMEOUT_MS: z.coerce.number().int().positive().default(600_000),
    YTDLP_PROBE_VIDEO_ID: z.string().regex(/^[A-Za-z0-9_-]{11}$/).default("aqz-KE-bpKQ"),
    YTDLP_POT_PROVIDER_URL: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().url().optional(),
    ),
    YTDLP_PROXY_URL: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().min(8).optional(),
    ),
    WARP_PROXY_URL: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().min(8).optional(),
    ),
    WARP_PROXY_HOST: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().min(1).optional(),
    ),
    WARP_PROXY_PORT: z.coerce.number().int().min(1).max(65_535).default(8080),
    WARP_POOL_URLS: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().min(8).optional(),
    ),
    WARP_POOL_SIZE: z.coerce.number().int().min(1).max(4).default(1),
    WARP_POOL_BASE_PORT: z.coerce.number().int().min(1).max(65_532).default(8080),
    WARP_POOL_MIN_HEALTHY: z.coerce.number().int().min(1).max(4).default(1),
    EGRESS_FINGERPRINT_KEY: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().min(32).optional(),
    ),
    YTDLP_PROXY_PROBE_TIMEOUT_MS: z.coerce.number().int().min(1_000).default(15_000),
    YTDLP_STARTUP_PROBE: z
      .enum(["true", "false"])
      .default("true")
      .transform((value) => value === "true"),
    TRUST_DIRECT_EGRESS: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    COBALT_API_URL: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().url().optional(),
    ),
    COBALT_API_KEY: optionalSecret,
    COBALT_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(300_000).default(45_000),
    PYTHON_ACQUISITION_URL: z.string().url().default("http://127.0.0.1:8090"),
    PYTHON_ACQUISITION_PORT: z.coerce.number().int().min(1).max(65_535).default(8090),
    PYTHON_ACQUISITION_TOKEN: optionalSecret,
    VIDRIAL_ACQUISITION_WEBHOOK_SECRET: optionalSecret,
    PYTHON_ACQUISITION_REQUIRED: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    PYTHON_ACQUISITION_POLL_MS: z.coerce.number().int().min(100).max(5_000).default(500),
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
    META_APP_ID: optionalSecret,
    META_APP_SECRET: optionalSecret,
    META_GRAPH_VERSION: z.string().regex(/^v\d{2}\.0$/).default("v25.0"),
    TIKTOK_CLIENT_KEY: optionalSecret,
    TIKTOK_CLIENT_SECRET: optionalSecret,
    TIKTOK_CONTENT_POSTING_AUDITED: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
    LINKEDIN_CLIENT_ID: optionalSecret,
    LINKEDIN_CLIENT_SECRET: optionalSecret,
    LINKEDIN_API_VERSION: z.string().regex(/^\d{6}$/).default("202605"),
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
  .superRefine((value, context) => {
    if (value.WARP_POOL_MIN_HEALTHY > value.WARP_POOL_SIZE && !value.WARP_POOL_URLS) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "WARP_POOL_MIN_HEALTHY cannot exceed WARP_POOL_SIZE.",
        path: ["WARP_POOL_MIN_HEALTHY"],
      });
    }
    if (value.COBALT_API_KEY && !value.COBALT_API_URL) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "COBALT_API_URL is required when COBALT_API_KEY is set.",
        path: ["COBALT_API_URL"],
      });
    }
  })
  .parse(process.env);
