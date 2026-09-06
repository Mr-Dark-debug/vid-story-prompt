import { describe, expect, it } from "vitest";
import { parseExactCutPaste, parseTimecodeMilliseconds, validateExactCutRanges } from "./exact-cut";
import { PLAN_ENTITLEMENTS } from "./entitlements";

const context = {
  sourceSeconds: 600,
  remainingSeconds: 3600,
  maximumClips: PLAN_ENTITLEMENTS.free.maxClipsPerJob,
};
const range = (start: string, end: string, label = "") => ({ start, end, label });

describe("Exact Cut timecodes", () => {
  it.each([
    ["0", 0],
    ["83", 83000],
    ["01:23", 83000],
    ["1:02:03.125", 3723125],
    ["90:00", 5400000],
    [" 00:00.001 ", 1],
    ["9.5", 9500],
  ])("parses %s without floating-point duration drift", (input, expected) => {
    expect(parseTimecodeMilliseconds(String(input))).toBe(expected);
  });
  it.each([
    "",
    "-1",
    "1:60",
    "1:60:00",
    "1:2:60",
    "Infinity",
    "NaN",
    "1e3",
    "0x10",
    "1.2:30",
    "1:2:3:4",
    "1.0001",
    "9007199254740992",
    "1 sec",
    "1.",
  ])("rejects malformed time %s", (input) => {
    expect(parseTimecodeMilliseconds(input)).toBeNull();
  });
});

describe("Exact Cut paste", () => {
  it("accepts mixed timestamp lengths, comma/newline separators and typographic dashes", () => {
    expect(parseExactCutPaste("30-45, 01:23 – 02:10\r\n1:02:03—1:02:10")).toEqual({
      errors: [],
      rows: [range("30", "45"), range("01:23", "02:10"), range("1:02:03", "1:02:10")],
    });
  });
  it("never silently drops an invalid row in a partially valid paste", () => {
    const result = parseExactCutPaste("30-45\ninvalid\n60-90");
    expect(result.rows).toEqual([]);
    expect(result.errors[0].entry).toBe(1);
  });
  it("rejects empty or unbounded input", () => {
    expect(parseExactCutPaste(" ,\n").errors).toHaveLength(1);
    expect(parseExactCutPaste("1-2,".repeat(5000)).rows).toEqual([]);
  });
});

describe("Exact Cut validation and metering", () => {
  it("preserves supplied order and bills selected durations, not full source runtime", () => {
    const result = validateExactCutRanges(
      [range("120", "135", " Ending "), range("30", "45")],
      context,
    );
    expect(result).toMatchObject({ valid: true, totalSeconds: 30, billableSeconds: 30 });
    expect(result.ranges).toEqual([
      { label: "Ending", startSeconds: 120, endSeconds: 135 },
      { startSeconds: 30, endSeconds: 45 },
    ]);
  });
  it("warns about overlapping clips without deduplicating or discounting them", () => {
    expect(
      validateExactCutRanges([range("0", "30"), range("10", "20"), range("30", "45")], context),
    ).toMatchObject({
      valid: true,
      billableSeconds: 55,
      overlaps: [{ first: 0, second: 1 }],
    });
  });
  it("rounds the total once, not every individual fractional range", () => {
    expect(
      validateExactCutRanges([range("0", "0.1"), range("1", "1.2"), range("2", "2.7")], context),
    ).toMatchObject({ valid: true, totalSeconds: 1, billableSeconds: 1 });
  });
  it("enforces row errors and source bounds without clamping requests", () => {
    const result = validateExactCutRanges(
      [range("invalid", "5"), range("10", "5"), range("600", "601")],
      context,
    );
    expect(result.valid).toBe(false);
    expect(result.ranges).toEqual([]);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "invalid_time",
      "end_before_start",
      "source_bounds",
      "source_bounds",
    ]);
  });
  it("accepts an end exactly at the source boundary", () => {
    expect(validateExactCutRanges([range("590", "600")], context).valid).toBe(true);
  });
  it("uses the canonical clip cap and remaining allowance", () => {
    expect(
      validateExactCutRanges(
        Array.from({ length: context.maximumClips + 1 }, () => range("0", "1")),
        context,
      ).valid,
    ).toBe(false);
    expect(
      validateExactCutRanges([range("0", "30")], { ...context, remainingSeconds: 29 }).valid,
    ).toBe(false);
    expect(
      validateExactCutRanges([range("0", "30")], { ...context, remainingSeconds: 30 }).valid,
    ).toBe(true);
  });
  it("fails closed for unavailable duration, allowance and invalid labels", () => {
    expect(
      validateExactCutRanges([range("0", "1")], { ...context, sourceSeconds: NaN }).valid,
    ).toBe(false);
    expect(
      validateExactCutRanges([range("0", "1")], { ...context, remainingSeconds: NaN }).valid,
    ).toBe(false);
    expect(validateExactCutRanges([range("0", "1")], { ...context, maximumClips: 0 }).valid).toBe(
      false,
    );
    expect(validateExactCutRanges([range("0", "1", "x".repeat(121))], context).valid).toBe(false);
    expect(validateExactCutRanges([], context).valid).toBe(false);
  });
});
