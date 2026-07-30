import { TaskFailure } from "../domain/types.js";

export type YouTubeDownloadStrategy =
  | "standard"
  | "web-safari"
  | "mweb-pot"
  | "web-embedded"
  | "android-vr";

export type YouTubeSourceSection = {
  endSeconds: number;
  startSeconds: number;
};

export function selectYouTubeDownloadStrategy(
  attempt: number,
  potProviderConfigured: boolean,
): YouTubeDownloadStrategy {
  if (attempt <= 1) return "standard";
  if (attempt === 2) return potProviderConfigured ? "mweb-pot" : "web-safari";
  if (attempt === 3) return "web-embedded";
  if (attempt === 4) return "android-vr";
  return potProviderConfigured ? "mweb-pot" : "web-safari";
}

export function readYouTubeSourceSection(
  input: Record<string, unknown>,
): YouTubeSourceSection | undefined {
  const raw = input.sourceSection;
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new TaskFailure("invalid_source_section", "The YouTube source section is invalid.", false);
  }
  const section = raw as Record<string, unknown>;
  if (
    typeof section.startSeconds !== "number" ||
    typeof section.endSeconds !== "number" ||
    !Number.isFinite(section.startSeconds) ||
    !Number.isFinite(section.endSeconds) ||
    section.startSeconds < 0 ||
    section.endSeconds <= section.startSeconds
  ) {
    throw new TaskFailure("invalid_source_section", "The YouTube source section is invalid.", false);
  }
  return { startSeconds: section.startSeconds, endSeconds: section.endSeconds };
}

export function classifyYouTubeDownloadFailure(input: string) {
  const message = input.toLowerCase();
  if (message.includes("private video") || message.includes("video is private")) {
    return new TaskFailure("video_private", "This YouTube video is private.", false);
  }
  if (message.includes("age-restricted") || message.includes("age restricted")) {
    return new TaskFailure(
      "video_age_restricted",
      "This YouTube video is age-restricted and cannot be imported.",
      false,
    );
  }
  if (
    message.includes("sign in to confirm") ||
    message.includes("not a bot") ||
    message.includes("proof of origin") ||
    message.includes("po token") ||
    message.includes("http error 403") ||
    message.includes("remote server returned 403")
  ) {
    return new TaskFailure(
      "provider_auth_challenge",
      "YouTube blocked this request from the server network.",
      true,
    );
  }
  if (message.includes("http error 429") || message.includes("too many requests")) {
    return new TaskFailure(
      "provider_rate_limited",
      "YouTube temporarily rate-limited the video worker.",
      true,
    );
  }
  if (
    message.includes("etimedout") ||
    message.includes("timed out") ||
    /http error 5\d\d/.test(message)
  ) {
    return new TaskFailure(
      "provider_temporary_failure",
      "YouTube was temporarily unavailable.",
      true,
    );
  }
  if (message.includes("video unavailable") || message.includes("has been removed")) {
    return new TaskFailure("video_unavailable", "This YouTube video is unavailable.", false);
  }
  return new TaskFailure(
    "provider_temporary_failure",
    "YouTube could not be reached through this acquisition path.",
    true,
  );
}

export function classifyYouTubeExecutionFailure(input: string) {
  const message = input.toLowerCase();
  if (
    message.includes("file is larger than max-filesize") ||
    message.includes("file exceeds max-filesize")
  ) {
    return new TaskFailure(
      "file_too_large",
      "The YouTube video exceeds the configured maximum file size.",
      false,
    );
  }
  if (message.includes("does not pass filter") || message.includes("is live")) {
    return new TaskFailure(
      "unsupported_video",
      "The YouTube video is live or exceeds the reserved duration.",
      false,
    );
  }
  return classifyYouTubeDownloadFailure(message);
}
