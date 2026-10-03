// Marks are bundled as raw SVG strings so they inherit `currentColor` and need no network request.
// The file name under src/assets/ai-providers is the registry's `logoKey`; there is no second list.
const marks = import.meta.glob<string>("../assets/ai-providers/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
});

const markByKey = new Map<string, string>(
  Object.entries(marks).map(([path, svg]) => [
    path.slice(path.lastIndexOf("/") + 1).replace(/\.svg$/, ""),
    svg,
  ]),
);

export function resolveProviderMark(logoKey: string): string {
  return markByKey.get(logoKey) ?? markByKey.get("generic") ?? "";
}
