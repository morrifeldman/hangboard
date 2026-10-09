import { describe, it, expect } from "vitest";
import {
  DAY_TYPE_LABELS,
  parseHHMM,
  reminderText,
  shouldFireReminder,
} from "../reminderCore";
import { SCHEDULE_TYPE_META } from "../schedules";
import type { ScheduleDayType } from "../schedules";

const morning = new Date(2026, 4, 20, 8, 0); // Wed May 20, 08:00 local
const earlyMorning = new Date(2026, 4, 20, 6, 30); // before 07:00

function args(over: Partial<Parameters<typeof shouldFireReminder>[0]> = {}) {
  return {
    enabled: true,
    time: "07:00",
    lastFired: null as string | null,
    now: morning,
    dayTypes: ["power"] as string[],
    ...over,
  };
}

describe("parseHHMM", () => {
  it("converts HH:MM to minutes", () => {
    expect(parseHHMM("07:00")).toBe(7 * 60);
    expect(parseHHMM("23:59")).toBe(23 * 60 + 59);
    expect(parseHHMM("00:00")).toBe(0);
  });

  it("returns NaN for invalid strings", () => {
    for (const s of ["", "7", "25:00", "12:60"]) {
      expect(Number.isNaN(parseHHMM(s))).toBe(true);
    }
  });
});

describe("shouldFireReminder", () => {
  it("fires after the configured time with a plan", () => {
    expect(shouldFireReminder(args())).toBe(true);
  });
  it("does not fire before the time", () => {
    expect(shouldFireReminder(args({ now: earlyMorning }))).toBe(false);
  });
  it("does not fire when already fired today", () => {
    expect(shouldFireReminder(args({ lastFired: "2026-05-20" }))).toBe(false);
  });
  it("fires when last fired on a previous day", () => {
    expect(shouldFireReminder(args({ lastFired: "2026-05-19" }))).toBe(true);
  });
  it("does not fire when disabled", () => {
    expect(shouldFireReminder(args({ enabled: false }))).toBe(false);
  });
  it("does not fire for an empty day", () => {
    expect(shouldFireReminder(args({ dayTypes: [] }))).toBe(false);
  });
  it("still fires for an explicit rest day (unchanged behaviour)", () => {
    expect(shouldFireReminder(args({ dayTypes: ["rest"] }))).toBe(true);
  });
  it("does not fire for an invalid time", () => {
    expect(shouldFireReminder(args({ time: "bogus" }))).toBe(false);
  });
});

describe("reminderText", () => {
  it("joins multiple day types", () => {
    const t = reminderText(["power", "cardio"]);
    expect(t.title).toBe("Today: Power + Cardio day");
    expect(t.body).toMatch(/Open Cairn/);
  });
  it("falls back to the raw type for unknown labels", () => {
    expect(reminderText(["mystery"]).title).toBe("Today: mystery day");
  });
});

describe("DAY_TYPE_LABELS", () => {
  it("matches SCHEDULE_TYPE_META for every day type, with no extras", () => {
    const types = Object.keys(SCHEDULE_TYPE_META) as ScheduleDayType[];
    for (const t of types) expect(DAY_TYPE_LABELS[t]).toBe(SCHEDULE_TYPE_META[t].label);
    expect(Object.keys(DAY_TYPE_LABELS).sort()).toEqual([...types].sort());
  });
});
