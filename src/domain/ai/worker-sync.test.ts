import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("worker copy of the AI domain", () => {
  it("matches src/domain/ai (run `npm run ai:sync` after editing the domain)", () => {
    const output = execFileSync(
      process.execPath,
      [join(process.cwd(), "scripts", "sync-worker-ai.mjs"), "--check"],
      {
        encoding: "utf8",
      },
    );
    expect(output).toMatch(/in sync/);
  });
});
