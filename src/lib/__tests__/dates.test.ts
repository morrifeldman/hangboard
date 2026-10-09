import { describe, it, expect } from "vitest";
import {
  addDays,
  dateKeyToTime,
  isDateKey,
  parseDateKey,
  startOfWeek,
  toLocalDateString,
  toLocalTimeString,
} from "../dates";

describe("dates", () => {
  it("formats local date keys with zero padding", () => {
    expect(toLocalDateString(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
    expect(toLocalDateString(new Date(2026, 0, 5).getTime())).toBe("2026-01-05");
  });

  it("formats local HH:MM", () => {
    expect(toLocalTimeString(new Date(2026, 0, 5, 7, 3))).toBe("07:03");
  });

  it("round-trips a date key through parseDateKey on the same local day", () => {
    for (const key of ["2026-01-01", "2026-03-08", "2026-11-01", "2026-12-31"]) {
      expect(toLocalDateString(parseDateKey(key))).toBe(key);
      expect(toLocalDateString(dateKeyToTime(key))).toBe(key);
    }
  });

  it("anchors weeks on Monday at local midnight", () => {
    const sun = new Date(2026, 9, 11, 15); // Sunday
    const mon = startOfWeek(sun);
    expect(mon.getDay()).toBe(1);
    expect(toLocalDateString(mon)).toBe("2026-10-05");
    expect(mon.getHours()).toBe(0);
    expect(toLocalDateString(startOfWeek(new Date(2026, 9, 5, 0, 1)))).toBe("2026-10-05");
  });

  it("adds calendar days across a month boundary", () => {
    expect(toLocalDateString(addDays(new Date(2026, 0, 30), 3))).toBe("2026-02-02");
  });

  it("recognises only YYYY-MM-DD keys", () => {
    expect(isDateKey("2026-10-09")).toBe(true);
    expect(isDateKey("10/9/2026")).toBe(false);
    expect(isDateKey("2026-10-09T00:00")).toBe(false);
    expect(isDateKey(42)).toBe(false);
  });
});
