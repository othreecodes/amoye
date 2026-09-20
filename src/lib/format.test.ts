import { describe, expect, it } from "vitest";
import { bucketOf } from "./format";

const NOW = Date.parse("2026-09-20T12:00:00Z");
const ago = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

describe("bucketOf", () => {
  it("names the recent buckets the way someone scanning a list would", () => {
    expect(bucketOf(ago(1), NOW)).toBe("Today");
    expect(bucketOf(ago(30), NOW)).toBe("Yesterday");
    expect(bucketOf(ago(24 * 3), NOW)).toBe("Earlier this week");
    expect(bucketOf(ago(24 * 10), NOW)).toBe("This month");
    expect(bucketOf(ago(24 * 100), NOW)).toBe("Earlier this year");
    expect(bucketOf(ago(24 * 500), NOW)).toBe("Older");
  });

  it("says so rather than guessing when there is no usable date", () => {
    expect(bucketOf(null, NOW)).toBe("No date");
    expect(bucketOf("not a date", NOW)).toBe("No date");
  });

  it("does not call a future timestamp yesterday", () => {
    expect(bucketOf(new Date(NOW + 3_600_000).toISOString(), NOW)).toBe("Today");
  });
});
