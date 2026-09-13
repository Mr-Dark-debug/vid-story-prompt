export type ExactCutDraft = { label: string; start: string; end: string };
export type ExactCutRange = { label?: string; startSeconds: number; endSeconds: number };
export type RangeIssue = {
  row: number;
  field: "label" | "start" | "end";
  code: "invalid_time" | "end_before_start" | "source_bounds" | "label_too_long";
  message: string;
};

// Integer milliseconds keep fractional clips from accumulating floating-point
// error in the usage preview. The database independently enforces the same sum.
export function parseTimecodeMilliseconds(input: string): number | null {
  const value = input.trim();
  if (!value || value.length > 32 || !/^\d+(?::\d+){0,2}(?:\.\d{1,3})?$/.test(value)) return null;
  const parts = value.split(":");
  const last = parts.pop()!;
  const [seconds, fraction = ""] = last.split(".");
  if (parts.length && Number(seconds) >= 60) return null;
  if (parts.length === 2 && Number(parts[1]) >= 60) return null;
  let wholeSeconds = Number(seconds);
  if (parts.length) wholeSeconds += Number(parts.at(-1)) * 60;
  if (parts.length === 2) wholeSeconds += Number(parts[0]) * 3600;
  const milliseconds = wholeSeconds * 1000 + Number(fraction.padEnd(3, "0"));
  return Number.isSafeInteger(milliseconds) ? milliseconds : null;
}

export function parseExactCutPaste(text: string) {
  const rows: ExactCutDraft[] = [];
  const errors: { entry: number; message: string }[] = [];
  if (text.length > 16_000)
    return { rows, errors: [{ entry: 0, message: "Paste is too long. Add a smaller batch." }] };
  const entries = text
    .split(/[,\r\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (!entries.length)
    return { rows, errors: [{ entry: 0, message: "Paste at least one start–end range." }] };
  entries.forEach((entry, index) => {
    const match = entry.match(/^([^\s–—-]+)\s*[-–—]\s*([^\s–—-]+)$/);
    if (
      !match ||
      parseTimecodeMilliseconds(match[1]) === null ||
      parseTimecodeMilliseconds(match[2]) === null
    ) {
      errors.push({
        entry: index,
        message: `Range ${index + 1}: use SS-SS, MM:SS-MM:SS or H:MM:SS-H:MM:SS.`,
      });
      return;
    }
    rows.push({ label: "", start: match[1], end: match[2] });
  });
  // A malformed paste must not silently submit only the successfully parsed rows.
  return { rows: errors.length ? [] : rows, errors };
}

export function validateExactCutRanges(
  drafts: readonly ExactCutDraft[],
  context: { sourceSeconds: number; remainingSeconds: number; maximumClips: number },
) {
  const issues: RangeIssue[] = [];
  const errors: string[] = [];
  const ranges: ExactCutRange[] = [];
  const intervals: { row: number; start: number; end: number }[] = [];
  const validSource = Number.isFinite(context.sourceSeconds) && context.sourceSeconds > 0;
  const validUsage = Number.isFinite(context.remainingSeconds) && context.remainingSeconds >= 0;
  const validLimit = Number.isSafeInteger(context.maximumClips) && context.maximumClips > 0;
  if (!validSource) errors.push("A verified source duration is required.");
  if (!validUsage || !validLimit) errors.push("Your plan allowance could not be checked.");
  if (!drafts.length) errors.push("Add at least one clip range.");
  if (validLimit && drafts.length > context.maximumClips)
    errors.push(`Your plan allows up to ${context.maximumClips} clips per job.`);
  let totalMilliseconds = 0;
  drafts.forEach((draft, row) => {
    const start = parseTimecodeMilliseconds(draft.start);
    const end = parseTimecodeMilliseconds(draft.end);
    const label = draft.label.trim();
    if (label.length > 120)
      issues.push({
        row,
        field: "label",
        code: "label_too_long",
        message: "Use a label of 120 characters or fewer.",
      });
    if (start === null)
      issues.push({
        row,
        field: "start",
        code: "invalid_time",
        message: "Enter a valid start time.",
      });
    if (end === null)
      issues.push({ row, field: "end", code: "invalid_time", message: "Enter a valid end time." });
    if (start === null || end === null) return;
    if (end <= start) {
      issues.push({
        row,
        field: "end",
        code: "end_before_start",
        message: "End must be after start.",
      });
      return;
    }
    if (validSource && start / 1000 >= context.sourceSeconds)
      issues.push({
        row,
        field: "start",
        code: "source_bounds",
        message: "Start must be before the source ends.",
      });
    if (validSource && end / 1000 > context.sourceSeconds)
      issues.push({
        row,
        field: "end",
        code: "source_bounds",
        message: "End exceeds the source duration.",
      });
    totalMilliseconds += end - start;
    ranges.push({
      ...(label ? { label } : {}),
      startSeconds: start / 1000,
      endSeconds: end / 1000,
    });
    intervals.push({ row, start, end });
  });
  if (!Number.isSafeInteger(totalMilliseconds)) errors.push("The requested duration is too large.");
  const billableSeconds = Math.ceil(totalMilliseconds / 1000);
  if (validUsage && billableSeconds > context.remainingSeconds)
    errors.push("These ranges exceed your remaining processing allowance.");
  const overlaps: { first: number; second: number }[] = [];
  for (let first = 0; first < intervals.length; first++) {
    for (let second = first + 1; second < intervals.length; second++) {
      const a = intervals[first],
        b = intervals[second];
      if (Math.max(a.start, b.start) < Math.min(a.end, b.end))
        overlaps.push({ first: a.row, second: b.row });
    }
  }
  return {
    valid: !issues.length && !errors.length,
    ranges: !issues.length && !errors.length ? ranges : [],
    issues,
    errors,
    overlaps,
    totalSeconds: totalMilliseconds / 1000,
    billableSeconds,
  };
}
