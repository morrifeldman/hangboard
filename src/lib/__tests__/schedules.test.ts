import { describe, it, expect } from "vitest";
import {
  toLocalDateString,
  startOfWeek,
  buildScheduleWeeks,
  normalizeDayTypes,
  typeMatches,
} from "../schedules";
import type { ScheduleDayType, ScheduleRecord } from "../schedules";
import type { SessionRecord } from "../history";
import type { ClimbRecord } from "../climbs";

function makeSchedule(date: string, dayTypes: ScheduleDayType[]): ScheduleRecord {
  return { id: `s-${date}`, date, dayTypes, createdAt: 0, updatedAt: 0 };
}

function makeSessionOn(
  date: Date,
  workoutType: SessionRecord["workoutType"] = "repeaters",
  id = "sess-1",
): SessionRecord {
  return {
    id,
    workoutType,
    startedAt: date.getTime(),
    completedAt: date.getTime() + 1000,
    bailed: false,
    holds: [],
  };
}

function makeClimb(
  date: string,
  overrides: Partial<ClimbRecord> = {},
  id = "climb-1",
): ClimbRecord {
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
    ...overrides,
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

describe("normalizeDayTypes", () => {
  it("returns the dayTypes array when present", () => {
    expect(normalizeDayTypes({ dayTypes: ["power", "rest"] })).toEqual(["power", "rest"]);
  });

  it("folds a legacy single dayType into an array", () => {
    expect(normalizeDayTypes({ dayType: "endurance" })).toEqual(["endurance"]);
  });

  it("prefers dayTypes over a stale legacy dayType", () => {
    expect(normalizeDayTypes({ dayTypes: ["outdoor"], dayType: "power" })).toEqual(["outdoor"]);
  });

  it("returns [] for an empty or missing record", () => {
    expect(normalizeDayTypes(undefined)).toEqual([]);
    expect(normalizeDayTypes({})).toEqual([]);
  });
});

describe("typeMatches (generous)", () => {
  const day = new Date(2026, 4, 19, 9, 0);

  it("hangboard matches any hangboard session", () => {
    expect(typeMatches("hangboard", [makeSessionOn(day, "max-hang")], [])).toBe(true);
    expect(typeMatches("hangboard", [makeSessionOn(day, "arc")], [])).toBe(false);
  });

  it("power matches max-hang, bouldering gym types, or a boulder climb", () => {
    expect(typeMatches("power", [makeSessionOn(day, "max-hang")], [])).toBe(true);
    expect(typeMatches("power", [makeSessionOn(day, "limit-bouldering")], [])).toBe(true);
    expect(typeMatches("power", [], [makeClimb("2026-05-19", { type: "boulder" })])).toBe(true);
    expect(typeMatches("power", [makeSessionOn(day, "arc")], [])).toBe(false);
    // wbl is a warm-up, not power
    expect(typeMatches("power", [makeSessionOn(day, "wbl")], [])).toBe(false);
    // campus board is contact-strength → power
    expect(typeMatches("power", [makeSessionOn(day, "campus")], [])).toBe(true);
  });

  it("endurance matches repeaters, arc/cir/pe-route/lbc, or a sport climb", () => {
    expect(typeMatches("endurance", [makeSessionOn(day, "repeaters")], [])).toBe(true);
    expect(typeMatches("endurance", [makeSessionOn(day, "arc")], [])).toBe(true);
    expect(typeMatches("endurance", [], [makeClimb("2026-05-19", { type: "sport" })])).toBe(true);
    expect(typeMatches("endurance", [makeSessionOn(day, "max-hang")], [])).toBe(false);
  });

  it("bouldering matches any boulder climb or bouldering gym types", () => {
    expect(typeMatches("bouldering", [], [makeClimb("2026-05-19", { type: "boulder" })])).toBe(true);
    expect(typeMatches("bouldering", [makeSessionOn(day, "hard-bouldering")], [])).toBe(true);
    expect(typeMatches("bouldering", [makeSessionOn(day, "wbl")], [])).toBe(true);
    expect(typeMatches("bouldering", [], [makeClimb("2026-05-19", { type: "sport" })])).toBe(false);
  });

  it("outdoor matches any outdoor climb", () => {
    expect(typeMatches("outdoor", [], [makeClimb("2026-05-19", { setting: "outdoor" })])).toBe(true);
    expect(typeMatches("outdoor", [], [makeClimb("2026-05-19", { setting: "indoor" })])).toBe(false);
  });

  it("stretching matches a stretching session", () => {
    expect(typeMatches("stretching", [makeSessionOn(day, "stretching")], [])).toBe(true);
    expect(typeMatches("stretching", [makeSessionOn(day, "repeaters")], [])).toBe(false);
  });

  it("rest matches when nothing — or only stretching / cardio — was logged", () => {
    expect(typeMatches("rest", [], [])).toBe(true);
    expect(typeMatches("rest", [makeSessionOn(day, "stretching")], [])).toBe(true);
    expect(typeMatches("rest", [makeSessionOn(day, "cardio")], [])).toBe(true);
    expect(
      typeMatches("rest", [makeSessionOn(day, "stretching"), makeSessionOn(day, "cardio", "s2")], []),
    ).toBe(true);
    expect(typeMatches("rest", [makeSessionOn(day)], [])).toBe(false);
    // stretching plus anything else (a session or a climb) breaks the rest day
    expect(
      typeMatches("rest", [makeSessionOn(day, "stretching"), makeSessionOn(day, "repeaters", "s2")], []),
    ).toBe(false);
    expect(typeMatches("rest", [makeSessionOn(day, "stretching")], [makeClimb("2026-05-19")])).toBe(false);
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

  it("normalizes a legacy single-dayType record into dayTypes", () => {
    const sched: ScheduleRecord[] = [
      { id: "legacy", date: "2026-05-19", dayType: "power", createdAt: 0, updatedAt: 0 },
    ];
    const weeks = buildScheduleWeeks(start, 1, sched, [], [], today);
    const day = weeks[0].find((d) => d.date === "2026-05-19")!;
    expect(day.dayTypes).toEqual(["power"]);
  });

  it("marks a planned type 'done' when a matching session was logged that day", () => {
    const session = makeSessionOn(new Date(2026, 4, 19, 9, 0), "repeaters");
    const sched = [makeSchedule("2026-05-19", ["hangboard"])];
    const weeks = buildScheduleWeeks(start, 1, sched, [session], [], today);
    const day = weeks[0].find((d) => d.date === "2026-05-19")!;
    expect(day.dayTypes).toEqual(["hangboard"]);
    expect(day.typeStatus).toEqual([{ type: "hangboard", state: "done" }]);
    expect(day.adherence).toBe("planned-and-logged");
  });

  it("marks done and missed per-type on a multi-type past day", () => {
    // logged a sport climb → endurance done; power (no boulder/max-hang) → missed
    const sched = [makeSchedule("2026-05-19", ["power", "endurance"])];
    const climb = makeClimb("2026-05-19", { type: "sport", setting: "indoor" });
    const weeks = buildScheduleWeeks(start, 1, sched, [], [climb], today);
    const day = weeks[0].find((d) => d.date === "2026-05-19")!;
    expect(day.typeStatus).toEqual([
      { type: "power", state: "missed" },
      { type: "endurance", state: "done" },
    ]);
  });

  it("marks an unlogged future planned type as 'upcoming'", () => {
    const sched = [makeSchedule("2026-05-23", ["outdoor"])]; // future Saturday
    const weeks = buildScheduleWeeks(start, 1, sched, [], [], today);
    const future = weeks[0].find((d) => d.date === "2026-05-23")!;
    expect(future.typeStatus).toEqual([{ type: "outdoor", state: "upcoming" }]);
    expect(future.adherence).toBe("planned-future");
  });

  it("treats a note-only schedule record as unplanned and surfaces the note", () => {
    const sched: ScheduleRecord[] = [
      { id: "n-1", date: "2026-05-19", note: "felt strong", createdAt: 0, updatedAt: 0 },
    ];
    const weeks = buildScheduleWeeks(start, 1, sched, [], [], today);
    const day = weeks[0].find((d) => d.date === "2026-05-19")!;
    expect(day.dayTypes).toEqual([]);
    expect(day.note).toBe("felt strong");
    expect(day.adherence).toBe("none");
  });
});
