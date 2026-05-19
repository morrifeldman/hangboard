import { describe, it, expect } from "vitest";
import {
  buildTrend,
  buildCalendar,
  calendarMonthLabels,
} from "../progressData";
import type { SessionRecord } from "../history";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSession(overrides: Partial<SessionRecord> & Pick<SessionRecord, "id" | "workoutType" | "startedAt">): SessionRecord {
  return {
    completedAt: overrides.startedAt + 3600000,
    bailed: false,
    holds: [
      {
        holdId: "jug",
        holdName: "Jug",
        set1: { weight: 0, reps: 7, completed: true },
        set2: { weight: 0, reps: 6, completed: true },
      },
      {
        holdId: "large-edge",
        holdName: "Large Edge",
        set1: { weight: 5, reps: 7, completed: true },
        set2: { weight: 15, reps: 6, completed: true },
      },
    ],
    ...overrides,
  };
}

/** Returns a Unix timestamp for a date at midnight UTC. */
function ts(dateStr: string): number {
  return new Date(dateStr).getTime();
}

// ─── buildTrend ───────────────────────────────────────────────────────────────

describe("buildTrend", () => {
  it("returns empty array for empty sessions", () => {
    expect(buildTrend([], "jug", "repeaters")).toEqual([]);
  });

  it("returns empty array when no sessions match workoutType", () => {
    const s = makeSession({ id: "1", workoutType: "max-hang", startedAt: ts("2024-01-10") });
    expect(buildTrend([s], "jug", "repeaters")).toEqual([]);
  });

  it("returns empty array when hold not present in sessions", () => {
    const s = makeSession({ id: "1", workoutType: "repeaters", startedAt: ts("2024-01-10") });
    // Session has "jug" and "large-edge" but not "sloper"
    expect(buildTrend([s], "sloper", "repeaters")).toEqual([]);
  });

  it("returns single point for a single matching session", () => {
    const s = makeSession({ id: "1", workoutType: "repeaters", startedAt: ts("2024-01-10") });
    const result = buildTrend([s], "jug", "repeaters");
    expect(result).toHaveLength(1);
    expect(result[0].weight).toBe(0);
    expect(result[0].bailed).toBe(false);
    expect(result[0].isPR).toBe(true); // only point is PR by definition
  });

  it("returns points ordered oldest→newest", () => {
    const sessions = [
      makeSession({ id: "3", workoutType: "repeaters", startedAt: ts("2024-01-15") }),
      makeSession({ id: "2", workoutType: "repeaters", startedAt: ts("2024-01-10") }),
      makeSession({ id: "1", workoutType: "repeaters", startedAt: ts("2024-01-05") }),
    ]; // newest-first (as getSessions returns)

    const result = buildTrend(sessions, "jug", "repeaters");
    expect(result[0].date.getTime()).toBeLessThan(result[1].date.getTime());
    expect(result[1].date.getTime()).toBeLessThan(result[2].date.getTime());
  });

  it("marks bailed sessions correctly", () => {
    const s = makeSession({ id: "1", workoutType: "repeaters", startedAt: ts("2024-01-10"), bailed: true });
    const result = buildTrend([s], "jug", "repeaters");
    expect(result[0].bailed).toBe(true);
  });

  it("marks isPR at the highest weight point", () => {
    const sessions = [
      makeSession({
        id: "3", workoutType: "repeaters", startedAt: ts("2024-01-15"),
        holds: [{ holdId: "jug", holdName: "Jug", set1: { weight: 5, reps: 7, completed: true }, set2: null }],
      }),
      makeSession({
        id: "2", workoutType: "repeaters", startedAt: ts("2024-01-10"),
        holds: [{ holdId: "jug", holdName: "Jug", set1: { weight: 10, reps: 7, completed: true }, set2: null }],
      }),
      makeSession({
        id: "1", workoutType: "repeaters", startedAt: ts("2024-01-05"),
        holds: [{ holdId: "jug", holdName: "Jug", set1: { weight: 3, reps: 7, completed: true }, set2: null }],
      }),
    ];
    const result = buildTrend(sessions, "jug", "repeaters");
    // Oldest→newest: 5kg, 10kg, 3kg ... wait, let me reorder:
    // sessions is newest-first: id=3 (Jan15, 5kg), id=2 (Jan10, 10kg), id=1 (Jan5, 3kg)
    // After slice(0,20).reverse(): Jan5(3kg), Jan10(10kg), Jan15(5kg)
    expect(result[0].weight).toBe(3);
    expect(result[1].weight).toBe(10);
    expect(result[2].weight).toBe(5);
    expect(result[0].isPR).toBe(false);
    expect(result[1].isPR).toBe(true); // 10 is max
    expect(result[2].isPR).toBe(false);
  });

  it("does not mark a set2-failed session as PR even if its weight is highest", () => {
    const sessions = [
      makeSession({
        id: "2", workoutType: "repeaters", startedAt: ts("2024-01-10"),
        holds: [{ holdId: "jug", holdName: "Jug", set1: { weight: 0, reps: 7, completed: true }, set2: { weight: 0, reps: 6, completed: true } }],
      }),
      makeSession({
        id: "1", workoutType: "repeaters", startedAt: ts("2024-01-05"),
        holds: [{ holdId: "jug", holdName: "Jug", set1: { weight: 5, reps: 7, completed: true }, set2: { weight: 5, reps: 6, completed: false } }],
      }),
    ];
    // newest-first
    const result = buildTrend(sessions, "jug", "repeaters");
    // Jan5 (weight=5, setFailed) then Jan10 (weight=0, success)
    expect(result[0].setFailed).toBe(true);
    expect(result[0].isPR).toBe(false); // set2 failed — not a PR
    expect(result[1].setFailed).toBe(false);
    expect(result[1].isPR).toBe(true); // highest fully-completed weight
  });

  it("sets setFailed=false when set2 is null (single-set hold)", () => {
    const s = makeSession({
      id: "1", workoutType: "repeaters", startedAt: ts("2024-01-10"),
      holds: [{ holdId: "jug", holdName: "Jug", set1: { weight: 10, reps: 7, completed: true }, set2: null }],
    });
    const result = buildTrend([s], "jug", "repeaters");
    expect(result[0].setFailed).toBe(false);
    expect(result[0].isPR).toBe(true);
  });

  it("marks setFailed when set3 fails (max-hang)", () => {
    const sessions = [
      makeSession({
        id: "1", workoutType: "max-hang", startedAt: ts("2024-01-05"),
        holds: [{
          holdId: "jug", holdName: "Jug",
          set1: { weight: 10, reps: 1, completed: true },
          set2: { weight: 10, reps: 1, completed: true },
          set3: { weight: 10, reps: 1, completed: false },
        }],
      }),
    ];
    const result = buildTrend(sessions, "jug", "max-hang");
    expect(result).toHaveLength(1);
    expect(result[0].setFailed).toBe(true);
    expect(result[0].isPR).toBe(false);
  });

  it("uses max weight across all sets", () => {
    const sessions = [
      makeSession({
        id: "1", workoutType: "max-hang", startedAt: ts("2024-01-05"),
        holds: [{
          holdId: "jug", holdName: "Jug",
          set1: { weight: 5, reps: 1, completed: true },
          set2: { weight: 10, reps: 1, completed: true },
          set3: { weight: 15, reps: 1, completed: true },
        }],
      }),
    ];
    const result = buildTrend(sessions, "jug", "max-hang");
    expect(result[0].weight).toBe(15);
    expect(result[0].isPR).toBe(true);
  });

  it("limits to 20 most recent sessions", () => {
    const sessions = Array.from({ length: 25 }, (_, i) =>
      makeSession({
        id: String(i),
        workoutType: "repeaters",
        startedAt: ts("2024-01-01") + i * 86400000,
        holds: [{ holdId: "jug", holdName: "Jug", set1: { weight: i, reps: 7, completed: true }, set2: null }],
      })
    ).reverse(); // newest-first

    const result = buildTrend(sessions, "jug", "repeaters");
    expect(result).toHaveLength(20);
    // Should be the 20 most recent (i=5..24), ordered oldest→newest
    expect(result[0].weight).toBe(5);
    expect(result[19].weight).toBe(24);
  });
});

// ─── buildCalendar ────────────────────────────────────────────────────────────

describe("buildCalendar", () => {
  it("returns 12 weeks × 7 days for empty sessions", () => {
    const grid = buildCalendar([]);
    expect(grid).toHaveLength(12);
    expect(grid[0]).toHaveLength(7);
    for (const week of grid) {
      for (const day of week) {
        expect(day.workoutType).toBeNull();
      }
    }
  });

  it("marks a workout-a day with 'a'", () => {
    // Use a day guaranteed to be in the last 12 weeks
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 7);
    const s = makeSession({ id: "1", workoutType: "repeaters", startedAt: recentDate.getTime() });
    const grid = buildCalendar([s]);
    const found = grid.flat().find((d) => d.workoutType !== null);
    expect(found?.workoutType).toBe("repeaters");
  });

  it("falls back to 'repeaters' when a day has both hangboard types (rare in practice)", () => {
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 5);
    const sa = makeSession({ id: "1", workoutType: "repeaters", startedAt: recentDate.getTime() });
    const sb = makeSession({ id: "2", workoutType: "max-hang", startedAt: recentDate.getTime() + 3600000 });
    const grid = buildCalendar([sa, sb]);
    const found = grid.flat().find((d) => d.workoutType !== null);
    expect(found?.workoutType).toBe("repeaters");
  });

  it("week array is in Monday→Sunday order (day 0 is Mon)", () => {
    const grid = buildCalendar([]);
    // Each week's first day should be a Monday (getDay() === 1)
    for (const week of grid) {
      expect(week[0].date.getDay()).toBe(1); // 1 = Monday
    }
  });

  it("does not include sessions older than 12 weeks", () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 90); // ~13 weeks ago
    const s = makeSession({ id: "1", workoutType: "repeaters", startedAt: oldDate.getTime() });
    const grid = buildCalendar([s]);
    const anyMarked = grid.flat().some((d) => d.workoutType !== null);
    expect(anyMarked).toBe(false);
  });

  it("marks note: false by default on every day", () => {
    const grid = buildCalendar([]);
    for (const week of grid) {
      for (const day of week) {
        expect(day.note).toBe(false);
      }
    }
  });

  it("marks note: true on days present in noteDates", () => {
    const recent = new Date();
    recent.setDate(recent.getDate() - 3);
    const key = `${recent.getFullYear()}-${String(recent.getMonth() + 1).padStart(2, "0")}-${String(recent.getDate()).padStart(2, "0")}`;
    const grid = buildCalendar([], undefined, new Set([key]));
    const noteDays = grid.flat().filter((d) => d.note);
    expect(noteDays).toHaveLength(1);
    expect(noteDays[0].workoutType).toBeNull();
    expect(noteDays[0].outdoor).toBe(false);
  });

  it("note flag is independent of workout/outdoor flags", () => {
    const recent = new Date();
    recent.setDate(recent.getDate() - 3);
    const key = `${recent.getFullYear()}-${String(recent.getMonth() + 1).padStart(2, "0")}-${String(recent.getDate()).padStart(2, "0")}`;
    const s = makeSession({ id: "1", workoutType: "repeaters", startedAt: recent.getTime() });
    const grid = buildCalendar([s], new Set([key]), new Set([key]));
    const day = grid.flat().find((d) => d.note);
    expect(day?.workoutType).toBe("repeaters");
    expect(day?.outdoor).toBe(true);
    expect(day?.note).toBe(true);
  });

  it("ignores notes outside the 12-week window", () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 90);
    const key = `${oldDate.getFullYear()}-${String(oldDate.getMonth() + 1).padStart(2, "0")}-${String(oldDate.getDate()).padStart(2, "0")}`;
    const grid = buildCalendar([], undefined, new Set([key]));
    const anyMarked = grid.flat().some((d) => d.note);
    expect(anyMarked).toBe(false);
  });
});

// ─── calendarMonthLabels ──────────────────────────────────────────────────────

describe("calendarMonthLabels", () => {
  it("returns 12 labels for a 12-week grid", () => {
    const grid = buildCalendar([]);
    const labels = calendarMonthLabels(grid);
    expect(labels).toHaveLength(12);
  });

  it("does not repeat a month label in consecutive weeks", () => {
    const grid = buildCalendar([]);
    const labels = calendarMonthLabels(grid);
    // No two consecutive non-empty labels should be the same
    // (the labels function should not repeat consecutive identical month labels)
    for (let i = 1; i < labels.length; i++) {
      if (labels[i] !== "" && labels[i - 1] !== "") {
        expect(labels[i]).not.toBe(labels[i - 1]);
      }
    }
  });
});

