// @vitest-environment node
import { describe, expect, it } from "vitest";
import { sandboxArguments } from "./sandbox.js";
import { validateSpec } from "./limits.js";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
const config = {
  image: "vidrial-motion-renderer:local",
  dockerPath: "docker",
  tempRoot: "/tmp",
  seccompProfile: "/opt/motion-seccomp.json",
  memoryMb: 1024,
  cpus: 1,
  pids: 256,
  timeoutMs: 120_000,
};
describe("motion sandbox admission", () => {
  it("denies clone3 with glibc's safe fallback error", () => {
    const profile = JSON.parse(
      readFileSync(new URL("../../motion-seccomp.json", import.meta.url), "utf8"),
    ) as {
      syscalls: { names: string[]; action: string; errnoRet?: number }[];
    };
    const rules = profile.syscalls.filter((rule) => rule.names.includes("clone3"));
    expect(rules).toEqual([expect.objectContaining({ action: "SCMP_ACT_ERRNO", errnoRet: 38 })]);
  });
  it("passes explicit OS controls and no credential environment", () => {
    const args = sandboxArguments(
      config,
      "vidrial-motion-00000000-0000-0000-0000-000000000000",
      "/tmp/one/input",
      "/tmp/one/output",
    );
    for (const control of [
      "--network=none",
      "--read-only",
      "--user=10001:10001",
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges",
      "--memory=1024m",
      "--memory-swap=1024m",
      "--pids-limit=256",
      "--ipc=private",
    ])
      expect(args).toContain(control);
    expect(args.join(" ")).not.toMatch(/--env|--privileged|docker.sock|--ipc=host|--no-sandbox/);
    expect(args).toContain(`type=bind,source=${resolve("/tmp/one/input")},target=/input,readonly`);
  });
  it("rejects mount injection and over-limit resources", () => {
    expect(() => sandboxArguments(config, "bad", "/tmp", "/tmp")).toThrow();
    expect(() =>
      sandboxArguments(
        { ...config, memoryMb: 100000 },
        "vidrial-motion-00000000-0000-0000-0000-000000000000",
        "/tmp",
        "/tmp",
      ),
    ).toThrow();
    expect(() =>
      sandboxArguments(
        config,
        "vidrial-motion-00000000-0000-0000-0000-000000000000",
        "/tmp,source=/",
        "/tmp",
      ),
    ).toThrow();
  });
  it("rejects invalid aspects, dimensions, duration and frame budgets", () => {
    const spec = { width: 1280, height: 720, fps: 30, durationSeconds: 8, aspect: "16:9" as const };
    expect(validateSpec(spec)).toEqual(spec);
    for (const invalid of [
      { ...spec, fps: 120 },
      { ...spec, width: 1279 },
      { ...spec, durationSeconds: NaN },
      { ...spec, durationSeconds: 61 },
      { ...spec, aspect: "1:1" as const },
    ])
      expect(() => validateSpec(invalid)).toThrow();
  });
});
