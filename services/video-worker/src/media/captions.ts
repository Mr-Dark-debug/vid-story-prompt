import type { CaptionCue, EditManifest } from "./manifest.js";

type CaptionSettings = EditManifest["captions"];
type TimedWord = { start: number; end: number; text: string };

const fontNames: Record<CaptionSettings["fontPreset"], string> = {
  clean_sans: "Liberation Sans",
  editorial_serif: "Liberation Serif",
  mono_signal: "Liberation Mono",
};

export function formatSrtTime(seconds: number) {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const secs = Math.floor((ms % 60_000) / 1000);
  const millis = ms % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}

export function formatVttTime(seconds: number) {
  return formatSrtTime(seconds).replace(",", ".");
}

function cuesFromText(text: string, duration: number): CaptionCue[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const cueCount = Math.ceil(words.length / 8);
  const cueDuration = duration / cueCount;
  return Array.from({ length: cueCount }, (_, index) => {
    const cueWords = words.slice(index * 8, index * 8 + 8);
    const startSeconds = index * cueDuration;
    const endSeconds = Math.min(duration, (index + 1) * cueDuration);
    const wordDuration = (endSeconds - startSeconds) / cueWords.length;
    return {
      startSeconds,
      endSeconds,
      text: cueWords.join(" "),
      words: cueWords.map((word, wordIndex) => ({
        startSeconds: startSeconds + wordIndex * wordDuration,
        endSeconds: startSeconds + (wordIndex + 1) * wordDuration,
        text: word,
      })),
    };
  });
}

export function buildCaptionCues(
  words: TimedWord[],
  clipStart: number,
  clipEnd: number,
): CaptionCue[] {
  const selected = words.filter((word) => word.end > clipStart && word.start < clipEnd);
  const cues: CaptionCue[] = [];
  let buffer: TimedWord[] = [];
  const flush = () => {
    if (!buffer.length) return;
    cues.push({
      startSeconds: Math.max(0, buffer[0].start - clipStart),
      endSeconds: Math.min(clipEnd - clipStart, buffer.at(-1)!.end - clipStart),
      text: buffer.map((word) => word.text).join(" "),
      words: buffer.map((word) => ({
        startSeconds: Math.max(0, word.start - clipStart),
        endSeconds: Math.min(clipEnd - clipStart, word.end - clipStart),
        text: word.text,
      })),
    });
    buffer = [];
  };
  for (const word of selected) {
    buffer.push(word);
    if (buffer.length >= 8 || /[.!?]["')\]]?$/.test(word.text)) flush();
  }
  flush();
  return cues.filter((cue) => cue.endSeconds > cue.startSeconds);
}

export function createSrt(text: string, duration: number, suppliedCues?: CaptionCue[]) {
  const cues = suppliedCues?.length ? suppliedCues : cuesFromText(text, duration);
  return cues
    .map(
      (cue, index) =>
        `${index + 1}\n${formatSrtTime(cue.startSeconds)} --> ${formatSrtTime(cue.endSeconds)}\n${cue.text}\n`,
    )
    .join("\n");
}

export function createVtt(text: string, duration: number, suppliedCues?: CaptionCue[]) {
  const cues = suppliedCues?.length ? suppliedCues : cuesFromText(text, duration);
  return `WEBVTT\n\n${cues
    .map(
      (cue) =>
        `${formatVttTime(cue.startSeconds)} --> ${formatVttTime(cue.endSeconds)}\n${cue.text}\n`,
    )
    .join("\n")}`;
}

function assTime(seconds: number) {
  const cs = Math.max(0, Math.round(seconds * 100));
  const hours = Math.floor(cs / 360_000);
  const minutes = Math.floor((cs % 360_000) / 6_000);
  const secs = Math.floor((cs % 6_000) / 100);
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`;
}

function escapeAss(value: string) {
  return value.replaceAll("\\", "／").replace(/[{}]/g, "").replace(/\r?\n/g, "\\N");
}

function assColor(hex: string, alpha = 0) {
  const value = hex.replace("#", "");
  const [r, g, b] = [value.slice(0, 2), value.slice(2, 4), value.slice(4, 6)];
  return `&H${Math.max(0, Math.min(255, alpha)).toString(16).padStart(2, "0")}${b}${g}${r}`.toUpperCase();
}

function alignment(position: CaptionSettings["position"], align: CaptionSettings["alignment"]) {
  const row = position === "top" ? 6 : position === "middle" ? 3 : 0;
  const column = align === "left" ? 1 : align === "right" ? 3 : 2;
  return row + column;
}

const profanity = new Set(["fuck", "fucking", "shit", "bitch", "asshole", "damn"]);

function normalizedWord(value: string) {
  return value.toLocaleLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

function displayWord(value: string, settings: CaptionSettings) {
  const normalized = normalizedWord(value);
  const masked = settings.profanityMask && profanity.has(normalized)
    ? value.replace(/[\p{L}\p{N}]/gu, "●")
    : value;
  const keyword = settings.keywordHighlight.some(
    (candidate) => normalizedWord(candidate) === normalized,
  );
  const escaped = escapeAss(masked);
  return keyword ? `{\\1c${assColor(settings.highlightColor)}}${escaped}{\\1c}` : escaped;
}

function styledText(value: string, settings: CaptionSettings) {
  return value
    .split(/(\s+)/)
    .map((part) => (/^\s+$/.test(part) ? part : displayWord(part, settings)))
    .join("");
}

function karaokeText(cue: CaptionCue, settings: CaptionSettings) {
  const words = cue.words.length
    ? cue.words
    : cuesFromText(cue.text, cue.endSeconds - cue.startSeconds)[0]?.words ?? [];
  return words
    .map((word) => {
      const centiseconds = Math.max(1, Math.round((word.endSeconds - word.startSeconds) * 100));
      return `{\\kf${centiseconds}}${displayWord(word.text, settings)}`;
    })
    .join(" ");
}

function wrapLines(text: string, wordsPerLine = 6) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  for (let index = 0; index < words.length; index += wordsPerLine) {
    lines.push(words.slice(index, index + wordsPerLine).join(" "));
  }
  return lines;
}

export function createAss(
  text: string,
  duration: number,
  options: {
    cues?: CaptionCue[];
    height?: number;
    settings?: Partial<CaptionSettings>;
    width?: number;
  } = {},
) {
  const width = Math.max(320, Math.round(options.width ?? 1080));
  const height = Math.max(320, Math.round(options.height ?? 1920));
  const defaults: CaptionSettings = {
    text,
    cues: [],
    fontPreset: "clean_sans",
    fontSize: 64,
    fontWeight: "bold",
    position: "bottom",
    alignment: "center",
    textColor: "#ffffff",
    highlightColor: "#ff9a66",
    backgroundColor: "#000000",
    backgroundOpacity: 0.5,
    strokeColor: "#101010",
    strokeWidth: 4,
    shadow: true,
    activeWord: true,
    keywordHighlight: [],
    animation: "word_highlight",
    profanityMask: false,
  };
  const settings = { ...defaults, ...options.settings };
  const cues = options.cues?.length
    ? options.cues
    : settings.cues.length
      ? settings.cues
      : cuesFromText(text, duration);
  const backgroundAlpha = Math.round((1 - settings.backgroundOpacity) * 255);
  const marginV = Math.round(height * 0.09);
  const style = [
    "Style: Default",
    fontNames[settings.fontPreset],
    settings.fontSize,
    assColor(settings.textColor),
    assColor(settings.highlightColor),
    assColor(settings.strokeColor),
    assColor(settings.backgroundColor, backgroundAlpha),
    settings.fontWeight === "bold" ? -1 : 0,
    0,
    0,
    0,
    100,
    100,
    0,
    0,
    settings.backgroundOpacity > 0 ? 3 : 1,
    settings.strokeWidth,
    settings.shadow ? 1 : 0,
    alignment(settings.position, settings.alignment),
    Math.round(width * 0.06),
    Math.round(width * 0.06),
    marginV,
    1,
  ].join(",");
  const events: string[] = [];
  for (const cue of cues) {
    const start = Math.max(0, cue.startSeconds);
    const end = Math.min(duration, cue.endSeconds);
    if (end <= start) continue;
    if (settings.animation === "line_reveal") {
      const lines = wrapLines(cue.text);
      const step = Math.min(0.25, (end - start) / Math.max(1, lines.length + 1));
      for (let index = 0; index < lines.length; index++) {
        const revealStart = start + index * step;
        const revealEnd = index === lines.length - 1 ? end : start + (index + 1) * step;
        events.push(
          `Dialogue: 0,${assTime(revealStart)},${assTime(revealEnd)},Default,,0,0,0,,${lines
            .slice(0, index + 1)
            .map((line) => styledText(line, settings))
            .join("\\N")}`,
        );
      }
      continue;
    }
    const cueText =
      settings.animation === "word_highlight" || settings.activeWord
        ? karaokeText(cue, settings)
        : styledText(cue.text, settings);
    const prefix =
      settings.animation === "pop"
        ? "{\\fad(80,120)\\fscx70\\fscy70\\t(0,180,\\fscx100\\fscy100)}"
        : "";
    events.push(
      `Dialogue: 0,${assTime(start)},${assTime(end)},Default,,0,0,0,,${prefix}${cueText}`,
    );
  }
  return `[Script Info]\nScriptType: v4.00+\nPlayResX: ${width}\nPlayResY: ${height}\nWrapStyle: 0\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n${style}\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n${events.join("\n")}\n`;
}
