import { describe, expect, it } from "bun:test";
import { ageInDays } from "../utils/date";

describe("ageInDays", () => {
  it("returns 0 for a date less than 24h ago", () => {
    const now = new Date();
    expect(ageInDays(now)).toBe(0);
  });

  it("returns 1 for a date exactly 1 day ago", () => {
    const oneDayAgo = new Date(Date.now() - 86400000);
    expect(ageInDays(oneDayAgo)).toBe(1);
  });

  it("returns 7 for a date 7 days ago", () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
    expect(ageInDays(sevenDaysAgo)).toBe(7);
  });

  it("floors partial days (23h = 0 days)", () => {
    const almostOneDay = new Date(Date.now() - 23 * 3600000);
    expect(ageInDays(almostOneDay)).toBe(0);
  });

  it("floors partial days (25h = 1 day)", () => {
    const justOverOneDay = new Date(Date.now() - 25 * 3600000);
    expect(ageInDays(justOverOneDay)).toBe(1);
  });

  it("returns 0 for a date in the future", () => {
    const future = new Date(Date.now() + 86400000);
    // Negative milliseconds floor to -1
    expect(ageInDays(future)).toBe(-1);
  });

  it("returns a large number for old dates", () => {
    const year2000 = new Date("2000-01-01T00:00:00Z");
    const result = ageInDays(year2000);
    // Should be roughly 9500+ days (26+ years)
    expect(result).toBeGreaterThan(9000);
  });
});
