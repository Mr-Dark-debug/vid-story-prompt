const dateFormatter = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });
const dateTimeFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export function formatUtcDate(value: string | number | Date) {
  return dateFormatter.format(new Date(value));
}

export function formatUtcDateTime(value: string | number | Date) {
  return `${dateTimeFormatter.format(new Date(value))} UTC`;
}
