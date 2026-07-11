import pino from "pino";
import { env } from "../config/env.js";
export const logger = pino({ level: env.LOG_LEVEL, redact: { paths: ["*.key", "*.token", "*.authorization", "SUPABASE_SERVICE_ROLE_KEY", "GROQ_API_KEY", "OPENAI_API_KEY", "OPENROUTER_API_KEY"], censor: "[REDACTED]" } });
