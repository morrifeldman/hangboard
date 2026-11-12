import { toLocalDateString } from "../dates";
import { describe, it, expect } from "vitest";
import {
  buildTrend,
  buildCalendar,
  calendarMonthLabels,
} from "../progressData";
import { sessionPRs } from "../personalRecords";
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
    expect(buildTrend([], "large-edge", "repeaters")).toEqual([]);
  });

  it("returns empty array when no sessions match workoutType", () => {
    const s = makeSession({ id: "1", workoutType: "max-hang", startedAt: ts("2024-01-10") });
    expect(buildTrend([s], "large-edge", "repeaters")).toEqual([]);
  });

  it("returns empty array when hold not present in sessions", () => {
    const s = makeSession({ id: "1", workoutType: "repeaters", startedAt: ts("2024-01-10") });
    // Session has "large-edge" and "large-edge" but not "sloper"
    expect(buildTrend([s], "sloper", "repeaters")).toEqual([]);
  });

  it("returns single point for a single matching session", () => {
    const s = makeSession({ id: "1", workoutType: "repeaters", startedAt: ts("2024-01-10") });
    const result = buildTrend([s], "large-edge", "repeaters");
    expect(result).toHaveLength(1);
    expect(result[0].weight).toBe(15);
    expect(result[0].bailed).toBe(false);
    expect(result[0].isPR).toBe(false); // first time on a hold is a baseline, not a PR
  });

  it("returns points ordered oldest→newest", () => {
    const sessions = [
      makeSession({ id: "3", workoutType: "repeaters", startedAt: ts("2024-01-15") }),
      makeSession({ id: "2", workoutType: "repeaters", startedAt: ts("2024-01-10") }),
      makeSession({ id: "1", workoutType: "repeaters", startedAt: ts("2024-01-05") }),
    ]; // newest-first (as getSessions returns)

    const result = buildTrend(sessions, "large-edge", "repeaters");
    expect(result[0].date.getTime()).toBeLessThan(result[1].date.getTime());
    expect(result[1].date.getTime()).toBeLessThan(result[2].date.getTime());
  });

  it("marks bailed sessions correctly", () => {
    const s = makeSession({ id: "1", workoutType: "repeaters", startedAt: ts("2024-01-10"), bailed: true });
    const result = buildTrend([s], "large-edge", "repeaters");
    expect(result[0].bailed).toBe(true);
  });

  it("marks isPR at the highest weight point", () => {
    const sessions = [
      makeSession({
        id: "3", workoutType: "repeaters", startedAt: ts("2024-01-15"),
        holds: [{ holdId: "large-edge", holdName: "Large Edge", set1: { weight: 5, reps: 7, completed: true }, set2: null }],
      }),
      makeSession({
        id: "2", workoutType: "repeaters", startedAt: ts("2024-01-10"),
        holds: [{ holdId: "large-edge", holdName: "Large Edge", set1: { weight: 10, reps: 7, completed: true }, set2: null }],
      }),
      makeSession({
        id: "1", workoutType: "repeaters", startedAt: ts("2024-01-05"),
        holds: [{ holdId: "large-edge", holdName: "Large Edge", set1: { weight: 3, reps: 7, completed: true }, set2: null }],
      }),
    ];
    const result = buildTrend(sessions, "large-edge", "repeaters");
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

  it("marks only the first session to reach the max weight", () => {
    const at = (id: string, date: string, weight: number) =>
      makeSession({
        id, workoutType: "repeaters", startedAt: ts(date),
        holds: [{ holdId: "large-edge", holdName: "Large Edge", set1: { weight, reps: 7, completed: true }, set2: null }],
      });
    // newest-first: Jan20(10), Jan15(10), Jan10(10), Jan5(5)
    const result = buildTrend(
      [at("4", "2024-01-20", 10), at("3", "2024-01-15", 10), at("2", "2024-01-10", 10), at("1", "2024-01-05", 5)],
      "large-edge",
      "repeaters"
    );
    expect(result.map((p) => p.isPR)).toEqual([false, true, false, false]);
  });

  it("ignores a failed set when working out the PR", () => {
    const result = buildTrend(
      [
        makeSession({
          id: "2", workoutType: "repeaters", startedAt: ts("2024-01-10"),
          holds: [{ holdId: "large-edge", holdName: "Large Edge", set1: { weight: 8, reps: 7, completed: true }, set2: null }],
        }),
        makeSession({
          id: "1", workoutType: "repeaters", startedAt: ts("2024-01-05"),
          holds: [{
            holdId: "large-edge", holdName: "Large Edge",
            set1: { weight: 5, reps: 7, completed: true },
            set2: { weight: 10, reps: 6, completed: false },
          }],
        }),
      ],
      "large-edge",
      "repeaters"
    );
    // Jan5: best completed weight is 5 (the failed 10 does not count) -> baseline.
    expect(result[0].setFailed).toBe(true);
    expect(result[0].weight).toBe(10);
    expect(result[0].isPR).toBe(false);
    // Jan10: 8 beats 5 -> PR, even though it is below the failed 10.
    expect(result[1].isPR).toBe(true);
  });

  it("never flags warm-up holds as PRs", () => {
    const at = (id: string, date: string, weight: number) =>
      makeSession({
        id, workoutType: "repeaters", startedAt: ts(date),
        holds: [{ holdId: "jug", holdName: "Jug", set1: { weight, reps: 7, completed: true }, set2: null }],
      });
    const result = buildTrend([at("2", "2024-01-10", 10), at("1", "2024-01-05", 5)], "jug", "repeaters");
    expect(result.map((p) => p.isPR)).toEqual([false, false]);
  });

  it("sorts by startedAt itself, whatever order sessions arrive in", () => {
    const at = (id: string, date: string, weight: number) =>
      makeSession({
        id, workoutType: "repeaters", startedAt: ts(date),
        holds: [{ holdId: "large-edge", holdName: "Large Edge", set1: { weight, reps: 7, completed: true }, set2: null }],
      });
    const oldestFirst = [at("1", "2024-01-05", 5), at("2", "2024-01-10", 10), at("3", "2024-01-15", 7)];
    const shuffled = [oldestFirst[1], oldestFirst[2], oldestFirst[0]];
    for (const input of [oldestFirst, shuffled]) {
      const result = buildTrend(input, "large-edge", "repeaters");
      expect(result.map((p) => p.sessionId)).toEqual(["1", "2", "3"]);
      expect(result.map((p) => p.isPR)).toEqual([false, true, false]);
    }
  });

  it("keeps the 20 newest even when sessions are oldest-first", () => {
    const sessions = Array.from({ length: 25 }, (_, i) =>
      makeSession({
        id: String(i), workoutType: "repeaters", startedAt: ts("2024-01-01") + i * 86400000,
        holds: [{ holdId: "large-edge", holdName: "Large Edge", set1: { weight: i, reps: 7, completed: true }, set2: null }],
      })
    );
    const result = buildTrend(sessions, "large-edge", "repeaters");
    expect(result[0].weight).toBe(5);
    expect(result[19].weight).toBe(24);
  });

  it("agrees with sessionPRs on which holds set a PR", () => {
    const w = (id: string, date: string, weights: Record<string, [number, boolean]>) =>
      makeSession({
        id, workoutType: "repeaters", startedAt: ts(date),
        holds: Object.entries(weights).map(([holdId, [weight, completed]]) => ({
          holdId, holdName: holdId, set1: { weight, reps: 7, completed }, set2: null,
        })),
      });
    const sessions = [
      w("5", "2024-02-01", { "large-edge": [20, true], "small-edge": [10, true], jug: [30, true] }),
      w("4", "2024-01-25", { "large-edge": [20, true], "small-edge": [5, false] }),
      w("3", "2024-01-20", { "large-edge": [15, true], "small-edge": [10, true] }),
      w("2", "2024-01-10", { "large-edge": [15, true], "small-edge": [5, true] }),
      w("1", "2024-01-05", { "large-edge": [10, true], "small-edge": [5, true], jug: [10, true] }),
    ];
    const prs = sessionPRs(sessions);
    for (const holdId of ["large-edge", "small-edge", "jug"]) {
      for (const p of buildTrend(sessions, holdId, "repeaters")) {
        expect(p.isPR, `${holdId} @ session ${p.sessionId}`).toBe(prs.get(p.sessionId)?.includes(holdId) ?? false);
      }
    }
    // Sanity: the data does contain PRs
    expect(prs.size).toBeGreaterThan(0);
  });

  it("sets setFailed=false when set2 is null (single-set hold)", () => {
    const s = makeSession({
      id: "1", workoutType: "repeaters", startedAt: ts("2024-01-10"),
      holds: [{ holdId: "large-edge", holdName: "Large Edge", set1: { weight: 10, reps: 7, completed: true }, set2: null }],
    });
    const result = buildTrend([s], "large-edge", "repeaters");
    expect(result[0].setFailed).toBe(false);
    expect(result[0].isPR).toBe(false);
  });

  it("marks setFailed when set3 fails (max-hang)", () => {
    const sessions = [
      makeSession({
        id: "1", workoutType: "max-hang", startedAt: ts("2024-01-05"),
        holds: [{
          holdId: "large-edge", holdName: "Large Edge",
          set1: { weight: 10, reps: 1, completed: true },
          set2: { weight: 10, reps: 1, completed: true },
          set3: { weight: 10, reps: 1, completed: false },
        }],
      }),
    ];
    const result = buildTrend(sessions, "large-edge", "max-hang");
    expect(result).toHaveLength(1);
    expect(result[0].setFailed).toBe(true);
    expect(result[0].isPR).toBe(false);
  });

  it("uses max weight across all sets", () => {
    const sessions = [
      makeSession({
        id: "1", workoutType: "max-hang", startedAt: ts("2024-01-05"),
        holds: [{
          holdId: "large-edge", holdName: "Large Edge",
          set1: { weight: 5, reps: 1, completed: true },
          set2: { weight: 10, reps: 1, completed: true },
          set3: { weight: 15, reps: 1, completed: true },
        }],
      }),
    ];
    const result = buildTrend(sessions, "large-edge", "max-hang");
    expect(result[0].weight).toBe(15);
    expect(result[0].isPR).toBe(false);
  });

  it("limits to 20 most recent sessions", () => {
    const sessions = Array.from({ length: 25 }, (_, i) =>
      makeSession({
        id: String(i),
        workoutType: "repeaters",
        startedAt: ts("2024-01-01") + i * 86400000,
        holds: [{ holdId: "large-edge", holdName: "Large Edge", set1: { weight: i, reps: 7, completed: true }, set2: null }],
      })
    ).reverse(); // newest-first

    const result = buildTrend(sessions, "large-edge", "repeaters");
    expect(result).toHaveLength(20);
    // Should be the 20 most recent (i=5..24), ordered oldest→newest
    expect(result[0].weight).toBe(5);
    expect(result[19].weight).toBe(24);
  });
});

// ─── buildCalendar ────────────────────────────────────────────────────────────

describe("buildCalendar", () => {
  const daysAgo = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
  };
  const marked = (grid: ReturnType<typeof buildCalendar>) =>
    grid.flat().filter((d) => d.categories.length > 0);

  it("returns 12 weeks × 7 days for empty sessions", () => {
    const grid = buildCalendar([]);
    expect(grid).toHaveLength(12);
    expect(grid[0]).toHaveLength(7);
    expect(marked(grid)).toHaveLength(0);
  });

  it("marks hangboard and climbing-gym sessions as indoor climbing", () => {
    const board = makeSession({ id: "1", workoutType: "repeaters", startedAt: daysAgo(7).getTime() });
    const maxHang = makeSession({ id: "2", workoutType: "max-hang", startedAt: daysAgo(7).getTime() + 3600000 });
    const arc = makeSession({
      id: "3", workoutType: "arc", startedAt: daysAgo(5).getTime(), holds: [],
      gymData: { type: "arc", climbMin: 30 },
    });
    const days = marked(buildCalendar([board, maxHang, arc]));
    expect(days.map((d) => d.categories)).toEqual([["indoor"], ["indoor"]]);
  });

  it("keeps lifting, cardio and stretching apart from climbing", () => {
    const at = daysAgo(3).getTime();
    const sessions = [
      makeSession({ id: "1", workoutType: "repeaters", startedAt: at }),
      makeSession({ id: "2", workoutType: "lifts", startedAt: at + 1, holds: [], gymData: { type: "lifts", lifts: [] } }),
      makeSession({
        id: "3", workoutType: "cardio", startedAt: at + 2, holds: [],
        gymData: { type: "cardio", mode: "Run", durationMin: 20 },
      }),
      makeSession({
        id: "4", workoutType: "stretching", startedAt: at + 3, holds: [],
        gymData: { type: "stretching", reps: 3, holdSec: 30 },
      }),
    ];
    const liftOnly = marked(buildCalendar([sessions[1]]));
    expect(liftOnly[0].categories).toEqual(["lifting"]);
    // Every category keeps its own slice, in display order.
    const all = marked(buildCalendar(sessions));
    expect(all).toHaveLength(1);
    expect(all[0].categories).toEqual(["indoor", "lifting", "cardio", "stretching"]);
  });

  it("counts freeform as other and gives an injury entry no colour", () => {
    const at = daysAgo(2).getTime();
    const freeform = makeSession({
      id: "1", workoutType: "freeform", startedAt: at, holds: [],
      gymData: { type: "freeform", title: "Yoga", sections: [] },
    });
    const injury = makeSession({
      id: "2", workoutType: "injury", startedAt: daysAgo(4).getTime(), holds: [],
      gymData: { type: "injury" },
    });
    const days = marked(buildCalendar([freeform, injury]));
    expect(days.map((d) => d.categories)).toEqual([["other"]]);
  });

  it("separates indoor from outdoor route logs", () => {
    const outdoorDay = toLocalDateString(daysAgo(3));
    const indoorDay = toLocalDateString(daysAgo(2));
    const bothDay = toLocalDateString(daysAgo(1));
    const grid = buildCalendar([], [
      { date: outdoorDay, setting: "outdoor" },
      { date: indoorDay, setting: "indoor" },
      { date: bothDay, setting: "indoor" },
      { date: bothDay, setting: "outdoor" },
    ]);
    const byDate = new Map(marked(grid).map((d) => [toLocalDateString(d.date), d.categories]));
    expect(byDate.get(outdoorDay)).toEqual(["outdoor"]);
    expect(byDate.get(indoorDay)).toEqual(["indoor"]);
    expect(byDate.get(bothDay)).toEqual(["outdoor", "indoor"]);
  });

  it("does not include sessions older than 12 weeks", () => {
    const s = makeSession({ id: "1", workoutType: "repeaters", startedAt: daysAgo(90).getTime() });
    expect(marked(buildCalendar([s]))).toHaveLength(0);
  });

  it("week array is in Monday→Sunday order (day 0 is Mon)", () => {
    const grid = buildCalendar([]);
    // Each week's first day should be a Monday (getDay() === 1)
    for (const week of grid) {
      expect(week[0].date.getDay()).toBe(1); // 1 = Monday
    }
  });

  it("flags exactly one day as today", () => {
    const grid = buildCalendar([]);
    const todays = grid.flat().filter((d) => d.isToday);
    expect(todays).toHaveLength(1);
    const now = new Date();
    expect(todays[0].date.getFullYear()).toBe(now.getFullYear());
    expect(todays[0].date.getMonth()).toBe(now.getMonth());
    expect(todays[0].date.getDate()).toBe(now.getDate());
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

