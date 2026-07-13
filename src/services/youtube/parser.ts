const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export class YouTubeUrlError extends Error {
  constructor(public readonly code: "invalid_url" | "unsupported_url" | "invalid_video_id") {
    super(code);
  }
}

export function parseYouTubeVideoId(input: string) {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new YouTubeUrlError("invalid_url");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:")
    throw new YouTubeUrlError("invalid_url");
  const host = url.hostname
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/^m\./, "");
  let candidate: string | null = null;
  if (host === "youtu.be") candidate = url.pathname.split("/").filter(Boolean)[0] ?? null;
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") candidate = url.searchParams.get("v");
    else {
      const [kind, id] = url.pathname.split("/").filter(Boolean);
      if (["shorts", "live", "embed"].includes(kind ?? "")) candidate = id ?? null;
      else throw new YouTubeUrlError("unsupported_url");
    }
  } else throw new YouTubeUrlError("unsupported_url");
  if (!candidate || !VIDEO_ID.test(candidate)) throw new YouTubeUrlError("invalid_video_id");
  return candidate;
}

export function parseIsoDuration(value: string) {
  const match = /^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(value);
  if (!match) throw new Error("invalid_iso_duration");
  return (
    Number(match[1] ?? 0) * 86400 +
    Number(match[2] ?? 0) * 3600 +
    Number(match[3] ?? 0) * 60 +
    Number(match[4] ?? 0)
  );
}
