const ERROR_MESSAGES: Array<[RegExp, string]> = [
  [
    /unsupported_url|invalid_video_id|invalid_url/i,
    "Enter a valid YouTube video URL, such as https://youtube.com/watch?v=…",
  ],
  [/invalid email|email.*invalid/i, "Enter a valid email address."],
  [
    /password.*(?:8|characters)|too short|string must contain at least 8/i,
    "Use a password with at least 8 characters.",
  ],
  [
    /display.?name|string must contain at least 2/i,
    "Enter a display name with at least 2 characters.",
  ],
  [/too many metadata requests/i, "Too many requests. Wait a minute, then try again."],
  [/unable to exchange external code|code verifier|pkce|oauth.*(?:expired|invalid)/i, "That Google sign-in attempt expired or was already used. Start Google sign-in again."],
  [/invalid login credentials/i, "The email or password is incorrect."],
  [/email not confirmed/i, "Verify your email before signing in."],
  [/user already registered|already been registered/i, "An account already exists for this email. Sign in instead."],
  [/network|fetch failed|failed to fetch/i, "The service could not be reached. Check your connection and try again."],
];

function errorText(cause: unknown) {
  if (cause instanceof Error) return cause.message;
  if (typeof cause === "string") return cause;
  return "";
}

export function userFacingError(cause: unknown, fallback: string) {
  const message = errorText(cause).trim();
  for (const [pattern, replacement] of ERROR_MESSAGES) {
    if (pattern.test(message)) return replacement;
  }
  if (!message || /^\s*\[?\s*\{/.test(message) || /"code"\s*:|zod/i.test(message)) return fallback;
  return message.replace(/\.$/, "") + ".";
}
