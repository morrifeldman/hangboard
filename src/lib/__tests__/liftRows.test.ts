import { describe, it, expect } from "vitest";
import { emptyLiftRow, liftRowToDraft, relinkLiftRow, withScheme } from "../liftRows";
import type { LiftDefinition } from "../lifts";

const scheme = { baseWeight: "135", sets: "3", reps: "5", repDiff: "-1", weightDiff: "10" };

describe("withScheme", () => {
  it("lays out the sets and starts the next base at the current base", () => {
    const row = withScheme({ ...emptyLiftRow(), name: "Bench" }, scheme);
    expect(row.sets.map((s) => `${s.reps}@${s.weight}`)).toEqual(["5@135", "4@145", "3@155"]);
    expect(row.nextBase).toBe(135);
  });

  it("clears the sets while the scheme is incomplete", () => {
    expect(withScheme(emptyLiftRow(), { ...scheme, sets: "" }).sets).toEqual([]);
  });
});

describe("relinkLiftRow", () => {
  const squat: LiftDefinition = {
    id: "squat", name: "Squat", baseWeight: 225, sets: 2, reps: 5, repDiff: 0, weightDiff: 0,
  };

  it("keeps the sets a past session logged and takes the lift's id and name", () => {
    const logged = { ...withScheme({ ...emptyLiftRow(), liftId: "bench", name: "Bench" }, scheme), nextBase: 140 };
    const row = relinkLiftRow(logged, squat);
    expect(row).toMatchObject({ liftId: "squat", name: "Squat", nextBase: 140 });
    expect(row.sets).toEqual(logged.sets);
  });

  it("lays out the lift's sets on a freshly added row", () => {
    const row = relinkLiftRow(emptyLiftRow(), squat);
    expect(row.sets.map((s) => `${s.reps}@${s.weight}`)).toEqual(["5@225", "5@225"]);
  });
});

describe("liftRowToDraft", () => {
  const row = withScheme({ ...emptyLiftRow(), name: " Bench " }, scheme);

  it("reads a filled-in row as numbers", () => {
    expect(liftRowToDraft(row)).toMatchObject({
      name: "Bench",
      scheme: { baseWeight: 135, sets: 3 },
      sets: [{ weight: 135, reps: 5, done: false }, { weight: 145, reps: 4 }, { weight: 155, reps: 3 }],
    });
  });

  it("rejects a row without a name or with a blank set", () => {
    expect(liftRowToDraft({ ...row, name: "" })).toBeNull();
    const blank = { ...row, sets: row.sets.map((s, i) => (i === 1 ? { ...s, weight: "" } : s)) };
    expect(liftRowToDraft(blank)).toBeNull();
  });
});
