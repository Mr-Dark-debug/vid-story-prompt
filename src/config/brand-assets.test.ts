import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { browserIconLinks } from "./brand-assets";

describe("Vidrial browser icons", () => {
  it("ships every declared icon with a versioned Vidrial URL", () => {
    for (const link of browserIconLinks) {
      expect(link.href).toMatch(/^\/icons\/vidrial-(?:\d+-)?v3\.(?:svg|png|ico)$/);
      expect(readFileSync(resolve(`public${link.href}`)).length).toBeGreaterThan(100);
    }
  });
  it("uses the shared logo geometry in both SVG entry points", () => {
    const component = readFileSync(resolve("src/components/primitives/logo.tsx"), "utf8");
    const paths = [...component.matchAll(/<path fill="currentColor" d="([^"]+)"/g)].map(
      (match) => match[1],
    );
    expect(paths).toHaveLength(2);
    for (const path of ["public/favicon.svg", "public/icons/vidrial-v3.svg"]) {
      const svg = readFileSync(resolve(path), "utf8");
      for (const geometry of paths) expect(svg).toContain(geometry);
    }
  });
  it("replaces the template ICO with three Vidrial PNG frames", () => {
    const ico = readFileSync(resolve("public/favicon.ico"));
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBe(3);
    for (const [index, size] of [16, 32, 48].entries()) {
      const entry = 6 + index * 16;
      const length = ico.readUInt32LE(entry + 8);
      const offset = ico.readUInt32LE(entry + 12);
      expect(ico[entry]).toBe(size);
      expect(ico.subarray(offset, offset + length)).toEqual(
        readFileSync(resolve(`public/icons/vidrial-${size}-v3.png`)),
      );
    }
  });
});
