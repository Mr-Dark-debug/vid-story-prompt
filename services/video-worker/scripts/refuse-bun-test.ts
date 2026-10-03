// Bun's built-in `bun test` runner cannot execute this package's Vitest suites and reports
// misleading failures. Fail fast with the correct command instead.
throw new Error(
  "Use `bun run test` (Vitest) in services/video-worker, or `npm run worker:test` from the repo root. `bun test` is not supported.",
);
