import { describe, it, expect } from "vitest";
import { parseHHMM, shouldFireToday } from "../notifications";
import type { NotificationPrefs } from "../notifications";

function prefs(over: Partial<NotificationPrefs> = {}): NotificationPrefs {
  return { enabled: true, time: "07:00", lastFiredDate: null, ...over };
}

const morning = new Date(2026, 4, 20, 8, 0); // Wed May 20, 08:00 local
const earlyMorning = new Date(2026, 4, 20, 6, 30); // 06:30 — before 07:00

describe("parseHHMM", () => {
  it("converts HH:MM to minutes", () => {
    expect(parseHHMM("07:00")).toBe(7 * 60);
    expect(parseHHMM("23:59")).toBe(23 * 60 + 59);
    expect(parseHHMM("00:00")).toBe(0);
  });

  it("returns NaN for invalid strings", () => {
    expect(Number.isNaN(parseHHMM(""))).toBe(true);
    expect(Number.isNaN(parseHHMM("7"))).toBe(true);
    expect(Number.isNaN(parseHHMM("25:00"))).toBe(true);
    expect(Number.isNaN(parseHHMM("12:60"))).toBe(true);
  });
});

describe("shouldFireToday", () => {
  it("returns false when disabled", () => {
    expect(shouldFireToday(prefs({ enabled: false }), morning, true)).toBe(false);
  });

  it("returns false when there is no plan for today", () => {
    expect(shouldFireToday(prefs(), morning, false)).toBe(false);
  });

  it("returns false when already fired today", () => {
    expect(
      shouldFireToday(prefs({ lastFiredDate: "2026-05-20" }), morning, true),
    ).toBe(false);
  });

  it("returns false before the reminder time", () => {
    expect(shouldFireToday(prefs(), earlyMorning, true)).toBe(false);
  });

  it("returns true in the happy path", () => {
    expect(shouldFireToday(prefs(), morning, true)).toBe(true);
  });

  it("returns true when fired on a different day", () => {
    expect(
      shouldFireToday(prefs({ lastFiredDate: "2026-05-19" }), morning, true),
    ).toBe(true);
  });
});
