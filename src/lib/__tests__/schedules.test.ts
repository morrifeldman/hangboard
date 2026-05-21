import { describe, it, expect } from "vitest";
import {
  toLocalDateString,
  startOfWeek,
  addDays,
  buildScheduleWeeks,
} from "../schedules";
import type { ScheduleRecord } from "../schedules";
import type { SessionRecord } from "../history";
import type { ClimbRecord } from "../climbs";

function makeSchedule(date: string, dayType: ScheduleRecord["dayType"]): ScheduleRecord {
  return { id: `s-${date}`, date, dayType, createdAt: 0, updatedAt: 0 };
}

function makeSessionOn(date: Date, id = "sess-1"): SessionRecord {
  return {
    id,
    workoutType: "repeaters",
    startedAt: date.getTime(),
    completedAt: date.getTime() + 1000,
    bailed: false,
    holds: [],
  };
}

function makeClimb(date: string, id = "climb-1"): ClimbRecord {
  return {
    id,
    route: "Test",
    grade: "5.10a",
    location: "Anywhere",
    type: "sport",
    setting: "outdoor",
    style: "redpoint",
    climbs: 1,
    date,
    notes: "",
  };
}

describe("toLocalDateString", () => {
  it("formats a date as YYYY-MM-DD in local TZ", () => {
    // Construct via local-time constructor so the assertion is timezone-independent
    const d = new Date(2026, 4, 19, 14, 30, 0); // May 19, 2026 14:30 local
    expect(toLocalDateString(d)).toBe("2026-05-19");
  });

  it("pads single-digit months and days", () => {
    const d = new Date(2026, 0, 3, 0, 0, 0); // Jan 3, 2026
    expect(toLocalDateString(d)).toBe("2026-01-03");
  });
});

describe("startOfWeek", () => {
  it("returns the preceding Monday for a Wednesday", () => {
    const wed = new Date(2026, 4, 20); // Wed May 20, 2026 (local)
    const mon = startOfWeek(wed);
    expect(toLocalDateString(mon)).toBe("2026-05-18");
    expect(mon.getDay()).toBe(1); // Monday
    expect(mon.getHours()).toBe(0);
  });

  it("returns the preceding Monday for a Sunday", () => {
    const sun = new Date(2026, 4, 24); // Sun May 24, 2026
    expect(toLocalDateString(startOfWeek(sun))).toBe("2026-05-18");
  });

  it("returns the same day when called on a Monday", () => {
    const mon = new Date(2026, 4, 18);
    expect(toLocalDateString(startOfWeek(mon))).toBe("2026-05-18");
  });
});

describe("buildScheduleWeeks", () => {
  const start = new Date(2026, 4, 18); // Mon May 18, 2026
  const today = new Date(2026, 4, 20); // Wed May 20

  it("produces weekCount * 7 days in chronological order", () => {
    const weeks = buildScheduleWeeks(start, 2, [], [], [], today);
    expect(weeks).toHaveLength(2);
    expect(weeks[0]).toHaveLength(7);
    expect(weeks[1]).toHaveLength(7);
    const dates = weeks.flat().map((d) => d.date);
    expect(dates[0]).toBe("2026-05-18");
    expect(dates[6]).toBe("2026-05-24");
    expect(dates[7]).toBe("2026-05-25");
    expect(dates[13]).toBe("2026-05-31");
    // Strictly increasing
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i] > dates[i - 1]).toBe(true);
    }
  });

  it("marks isToday for the current local day", () => {
    const weeks = buildScheduleWeeks(start, 1, [], [], [], today);
    const todays = weeks[0].filter((d) => d.isToday);
    expect(todays).toHaveLength(1);
    expect(todays[0].date).toBe("2026-05-20");
  });

  it("assigns planned-and-logged when a scheduled past day has a session that day", () => {
    const yesterday = addDays(today, -1); // Tue May 19
    const session = makeSessionOn(new Date(2026, 4, 19, 9, 0));
    const sched = [makeSchedule("2026-05-19", "power")];
    const weeks = buildScheduleWeeks(start, 1, sched, [session], [], today);
    const day = weeks[0].find((d) => d.date === "2026-05-19")!;
    expect(day.dayType).toBe("power");
    expect(day.adherence).toBe("planned-and-logged");
    expect(day.logged.sessions).toHaveLength(1);
    expect(yesterday.getDate()).toBe(19); // sanity
  });

  it("assigns planned-not-logged for a past scheduled day with no log", () => {
    const sched = [makeSchedule("2026-05-19", "endurance")];
    const weeks = buildScheduleWeeks(start, 1, sched, [], [], today);
    const day = weeks[0].find((d) => d.date === "2026-05-19")!;
    expect(day.adherence).toBe("planned-not-logged");
  });

  it("distinguishes planned-future from unplanned-logged", () => {
    const sched = [makeSchedule("2026-05-23", "outdoor")]; // future Saturday
    const climbToday = makeClimb("2026-05-20"); // today, unplanned
    const weeks = buildScheduleWeeks(start, 1, sched, [], [climbToday], today);
    const future = weeks[0].find((d) => d.date === "2026-05-23")!;
    const todayCell = weeks[0].find((d) => d.date === "2026-05-20")!;
    expect(future.adherence).toBe("planned-future");
    expect(todayCell.adherence).toBe("unplanned-logged");
    expect(todayCell.dayType).toBeUndefined();
  });
});
