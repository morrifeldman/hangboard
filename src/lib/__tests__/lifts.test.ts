import { describe, it, expect } from "vitest";
import {
  generateSets,
  parseScheme,
  commitLifts,
  formatScheme,
  formatLiftEntry,
  formatLiftsSummary,
  buildLiftTrend,
  currentLiftName,
  withCurrentLiftNames,
} from "../lifts";
import type { LiftDefinition, LiftEntry, LiftScheme } from "../lifts";
import type { SessionRecord } from "../history";

const pyramid: LiftScheme = { baseWeight: 135, sets: 3, reps: 5, repDiff: -1, weightDiff: 10 };
const straight: LiftScheme = { baseWeight: 225, sets: 3, reps: 5, repDiff: 0, weightDiff: 0 };

describe("generateSets", () => {
  it("steps reps and weight per set", () => {
    expect(generateSets(pyramid)).toEqual([
      { weight: 135, reps: 5, done: false },
      { weight: 145, reps: 4, done: false },
      { weight: 155, reps: 3, done: false },
    ]);
  });

  it("rounds weights to the nearest 2.5 lb", () => {
    const sets = generateSets({ ...straight, baseWeight: 101, weightDiff: 1.3 });
    expect(sets.map((s) => s.weight)).toEqual([100, 102.5, 102.5]);
  });

  it("never drops reps below 1", () => {
    const sets = generateSets({ ...straight, sets: 4, reps: 2, repDiff: -1 });
    expect(sets.map((s) => s.reps)).toEqual([2, 1, 1, 1]);
  });

  it("never drops weight below 0", () => {
    const sets = generateSets({ ...straight, baseWeight: 10, weightDiff: -10 });
    expect(sets.map((s) => s.weight)).toEqual([10, 0, 0]);
  });
});

describe("parseScheme", () => {
  const fields = { baseWeight: "135", sets: "3", reps: "5", repDiff: "-1", weightDiff: "10" };

  it("reads a complete scheme", () => {
    expect(parseScheme(fields)).toEqual(pyramid);
  });

  it("rejects blanks, zero sets and fractional reps", () => {
    expect(parseScheme({ ...fields, baseWeight: "" })).toBeNull();
    expect(parseScheme({ ...fields, sets: "0" })).toBeNull();
    expect(parseScheme({ ...fields, reps: "4.5" })).toBeNull();
  });
});

describe("commitLifts", () => {
  const library: LiftDefinition[] = [{ id: "squat", name: "Squat", ...straight }];
  let n = 0;
  const makeId = () => `new-${++n}`;

  it("links a known name to its library lift regardless of case", () => {
    const { entries, created } = commitLifts(
      library,
      [{ name: " squat ", scheme: straight, sets: generateSets(straight), nextBase: 230 }],
      makeId,
    );
    expect(created).toEqual([]);
    expect(entries[0]).toMatchObject({ liftId: "squat", name: "squat", nextBase: 230 });
  });

  it("creates a new lift at its next base, shared by rows with the same name", () => {
    const draft = { name: "Bench", scheme: pyramid, sets: generateSets(pyramid), nextBase: 140 };
    const { entries, created } = commitLifts(library, [draft, { ...draft, name: "bench" }], makeId);
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ name: "Bench", baseWeight: 140, sets: 3, repDiff: -1 });
    expect(entries[0].liftId).toBe(created[0].id);
    expect(entries[1].liftId).toBe(created[0].id);
  });

  it("keeps a saved row's lift id even if the library lift was renamed since", () => {
    const { entries, created } = commitLifts(
      library,
      [{ liftId: "old-squat", name: "Back squat", scheme: straight, sets: [], nextBase: 225 }],
      makeId,
    );
    expect(created).toEqual([]);
    expect(entries[0].liftId).toBe("old-squat");
  });
});

describe("formatting", () => {
  it("describes a scheme, leaving out zero steps", () => {
    expect(formatScheme({ ...straight, repDiff: -1, weightDiff: 10 })).toBe("225 · 3×5 −1 rep +10 lb");
    expect(formatScheme(straight)).toBe("225 · 3×5");
    expect(formatScheme({ ...straight, repDiff: 2, weightDiff: -5 })).toBe("225 · 3×5 +2 reps −5 lb");
  });

  const entry = (sets: LiftEntry["sets"], name = "Squat"): LiftEntry => ({
    liftId: "x", name, scheme: straight, sets, nextBase: 225,
  });

  it("summarises straight sets as sets × reps", () => {
    const done = generateSets(straight).map((s) => ({ ...s, done: true }));
    expect(formatLiftEntry(entry(done))).toBe("Squat 3×5 @ 225");
  });

  it("lists varying reps and the weight range, counting only done sets", () => {
    const sets = generateSets(pyramid).map((s, i) => ({ ...s, done: i < 2 }));
    expect(formatLiftEntry(entry(sets, "Bench"))).toBe("Bench 5/4 @ 135–145");
  });

  it("joins lifts with dots", () => {
    const done = generateSets(straight).map((s) => ({ ...s, done: true }));
    expect(formatLiftsSummary([entry(done), entry([], "Bench")])).toBe("Squat 3×5 @ 225 · Bench skipped");
  });
});

describe("buildLiftTrend", () => {
  const session = (id: string, startedAt: number, weights: number[], done = true): SessionRecord => ({
    id,
    workoutType: "lifts",
    startedAt,
    completedAt: startedAt,
    bailed: false,
    holds: [],
    gymData: {
      type: "lifts",
      lifts: [{
        liftId: "squat",
        name: "Squat",
        scheme: straight,
        sets: weights.map((weight) => ({ weight, reps: 5, done })),
        nextBase: 225,
      }],
    },
  });

  it("plots the heaviest done set per session, oldest first", () => {
    const sessions = [session("b", 2000, [225, 235]), session("a", 1000, [215, 225])];
    const trend = buildLiftTrend(sessions, "squat");
    expect(trend.map((p) => [p.sessionId, p.weight])).toEqual([["a", 225], ["b", 235]]);
  });

  it("marks the first session to reach the top weight as the PR", () => {
    const sessions = [session("c", 3000, [235]), session("b", 2000, [235]), session("a", 1000, [225])];
    expect(buildLiftTrend(sessions, "squat").map((p) => p.isPR)).toEqual([false, true, false]);
  });

  it("skips sessions where nothing was done and other lifts", () => {
    const sessions = [session("b", 2000, [300], false), session("a", 1000, [225])];
    expect(buildLiftTrend(sessions, "squat").map((p) => p.sessionId)).toEqual(["a"]);
    expect(buildLiftTrend(sessions, "bench")).toEqual([]);
  });
});

describe("current lift names", () => {
  const library: LiftDefinition[] = [{ id: "squat", name: "Back squat", ...straight }];
  const entry = (liftId: string, name: string): LiftEntry => ({
    liftId, name, scheme: straight, sets: [], nextBase: 225,
  });

  it("shows a renamed lift under its new name", () => {
    expect(currentLiftName(entry("squat", "Squat"), library)).toBe("Back squat");
  });

  it("falls back to the saved name once the lift is deleted", () => {
    expect(currentLiftName(entry("gone", "Front squat"), library)).toBe("Front squat");
  });

  it("renames the lifts in a session without touching the stored record", () => {
    const record: SessionRecord = {
      id: "s", workoutType: "lifts", startedAt: 0, completedAt: 0, bailed: false, holds: [],
      gymData: { type: "lifts", lifts: [entry("squat", "Squat")] },
    };
    const shown = withCurrentLiftNames(record, library);
    expect(shown.gymData).toMatchObject({ lifts: [{ name: "Back squat" }] });
    expect(record.gymData).toMatchObject({ lifts: [{ name: "Squat" }] });
  });

  it("passes other sessions through unchanged", () => {
    const record: SessionRecord = {
      id: "s", workoutType: "repeaters", startedAt: 0, completedAt: 0, bailed: false, holds: [],
    };
    expect(withCurrentLiftNames(record, library)).toBe(record);
  });
});
