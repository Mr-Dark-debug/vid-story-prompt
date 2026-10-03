export const RETENTION_OPTIONS = [
  { value: "keep", label: "Keep until I delete them", days: null },
  { value: "7", label: "7 days after the last message", days: 7 },
  { value: "30", label: "30 days after the last message", days: 30 },
  { value: "90", label: "90 days after the last message", days: 90 },
  { value: "365", label: "1 year after the last message", days: 365 },
] as const;

/** Maps a stored day count to the closest offered option; unknown values stay visible as custom. */
export function retentionValue(days: number | null): string {
  if (days === null) return "keep";
  return RETENTION_OPTIONS.some((option) => option.days === days) ? String(days) : `custom:${days}`;
}
