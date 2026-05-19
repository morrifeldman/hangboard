import { describe, it, expect } from "vitest";
import {
  totalWorkoutSecs,
  currentPhaseFullSecs,
  remainingWorkoutSecs,
} from "../workoutTime";
import type { SessionState } from "../stateMachine";
import type { HoldDefinition } from "../../data/holds";
import { HOLDS } from "../../data/holds";
import { HOLDS_B } from "../../data/workout-b";

// Globals as imported by workoutTime.ts. In Vitest (node env, no VITE_TEST_MODE),
// these resolve to the production values from src/data/workout.ts.
const PREP = 10;
const HANG = 7;
const REST = 3;
const BREAK = 180;
const S1 = 7;
const S2 = 6;

function hold(overrides: Partial<HoldDefinition> = {}): HoldDefinition {
  return {
    id: "t", name: "Test", defaultSet1Weight: 0, defaultSet2Weight: 0,
    set1Reps: S1, set2Reps: S2, ...overrides,
  };
}

describe("totalWorkoutSecs", () => {
  it("sums prep + hangs + rests + break per set across holds (Workout A)", () => {
    // Workout A: 8 holds × 2 sets, default reps (7, 6), default phase secs.
    // Per-set seconds:
    //   set1 = PREP + 7*HANG + 6*REST + BREAK = 10 + 49 + 18 + 180 = 257
    //   set2 = PREP + 6*HANG + 5*REST + BREAK = 10 + 42 + 15 + 180 = 247
    // Per hold = 257 + 247 = 504. Workout A has 8 holds → 504 * 8 = 4032.
    expect(totalWorkoutSecs(HOLDS, S1, S2)).toBe(504 * 8);
  });

  it("handles isRestOnly holds (prep + break only per set)", () => {
    const h = hold({ isRestOnly: true, numSets: 2, breakSecs: 60 });
    // 2 × (PREP + 60) = 2 × 70 = 140
    expect(totalWorkoutSecs([h], S1, S2)).toBe(140);
  });

  it("handles prepBetweenReps (extra prep after each rest)", () => {
    // 1 set, 3 reps, prepBetweenReps: prep + hang + (rest+prep+hang) × 2 + break
    const h = hold({
      numSets: 1, repsPerSet: 3, prepBetweenReps: true,
      hangSecs: 10, restSecs: 30, breakSecs: 30,
    });
    // 10 + 10 + (30 + 10 + 10) + (30 + 10 + 10) + 30 = 150
    expect(totalWorkoutSecs([h], S1, S2)).toBe(150);
  });

  it("respects per-hold timer overrides", () => {
    const h = hold({
      numSets: 1, repsPerSet: 1,
      prepSecs: 5, hangSecs: 12, breakSecs: 100,
    });
    // 1 set, 1 rep: prep + hang + break = 5 + 12 + 100 = 117 (no rest, only 1 rep)
    expect(totalWorkoutSecs([h], S1, S2)).toBe(117);
  });

  it("matches a hand-rolled Workout B total", () => {
    // Spot-check: walk HOLDS_B and verify totalWorkoutSecs matches a manual sum.
    let manual = 0;
    for (const h of HOLDS_B) {
      const numSets = h.numSets ?? 2;
      for (let s = 1; s <= numSets; s++) {
        const prep = h.prepSecs ?? PREP;
        const brk  = h.breakSecs ?? BREAK;
        if (h.isRestOnly) { manual += prep + brk; continue; }
        const reps = h.repsPerSet ?? (s === 1 ? S1 : S2);
        let setSecs = prep;
        for (let r = 0; r < reps; r++) {
          setSecs += h.hangSecs ?? HANG;
          if (r < reps - 1) {
            setSecs += h.restSecs ?? REST;
            if (h.prepBetweenReps) setSecs += prep;
          }
        }
        setSecs += brk;
        manual += setSecs;
      }
    }
    expect(totalWorkoutSecs(HOLDS_B, S1, S2)).toBe(manual);
  });
});

describe("currentPhaseFullSecs", () => {
  const holds = [hold({ prepSecs: 5, hangSecs: 9, restSecs: 4, breakSecs: 120 })];
  const base: SessionState = { phase: "prep", holdIndex: 0, setNumber: 1, repIndex: 0 };

  it("returns the per-hold override for each phase", () => {
    expect(currentPhaseFullSecs({ ...base, phase: "prep" },    holds)).toBe(5);
    expect(currentPhaseFullSecs({ ...base, phase: "hanging" }, holds)).toBe(9);
    expect(currentPhaseFullSecs({ ...base, phase: "resting" }, holds)).toBe(4);
    expect(currentPhaseFullSecs({ ...base, phase: "break" },   holds)).toBe(120);
  });

  it("returns 0 for idle/done", () => {
    expect(currentPhaseFullSecs({ ...base, phase: "idle" }, holds)).toBe(0);
    expect(currentPhaseFullSecs({ ...base, phase: "done" }, holds)).toBe(0);
  });

  it("falls back to globals when no override", () => {
    const plain = [hold()];
    expect(currentPhaseFullSecs({ ...base, phase: "prep" },    plain)).toBe(PREP);
    expect(currentPhaseFullSecs({ ...base, phase: "hanging" }, plain)).toBe(HANG);
    expect(currentPhaseFullSecs({ ...base, phase: "resting" }, plain)).toBe(REST);
    expect(currentPhaseFullSecs({ ...base, phase: "break" },   plain)).toBe(BREAK);
  });
});

describe("remainingWorkoutSecs", () => {
  it("equals the total when called at workout start with full prep remaining", () => {
    const total = totalWorkoutSecs(HOLDS, S1, S2);
    const start: SessionState = { phase: "prep", holdIndex: 0, setNumber: 1, repIndex: 0 };
    expect(remainingWorkoutSecs(start, HOLDS, S1, S2, PREP)).toBe(total);
  });

  it("returns 0 at done", () => {
    const s: SessionState = { phase: "done", holdIndex: 7, setNumber: 2, repIndex: 5 };
    expect(remainingWorkoutSecs(s, HOLDS, S1, S2, 0)).toBe(0);
  });

  it("returns 0 at idle", () => {
    const s: SessionState = { phase: "idle", holdIndex: 0, setNumber: 1, repIndex: 0 };
    expect(remainingWorkoutSecs(s, HOLDS, S1, S2, 0)).toBe(0);
  });

  it("on the last hang of the last rep of the last set of the last hold, equals hang remaining + final break", () => {
    // Workout A, hold 7 (med-pinch), set 2, rep 5 (last of 6), phase hanging.
    const s: SessionState = { phase: "hanging", holdIndex: 7, setNumber: 2, repIndex: 5 };
    // Remaining = currentPhaseRemaining + final break
    expect(remainingWorkoutSecs(s, HOLDS, S1, S2, HANG)).toBe(HANG + BREAK);
    expect(remainingWorkoutSecs(s, HOLDS, S1, S2, 0)).toBe(BREAK);
  });

  it("drops by exactly one set's worth between consecutive holds (start of next hold)", () => {
    const h0Start: SessionState = { phase: "prep", holdIndex: 0, setNumber: 1, repIndex: 0 };
    const h1Start: SessionState = { phase: "prep", holdIndex: 1, setNumber: 1, repIndex: 0 };
    const rem0 = remainingWorkoutSecs(h0Start, HOLDS, S1, S2, PREP);
    const rem1 = remainingWorkoutSecs(h1Start, HOLDS, S1, S2, PREP);
    // Each hold contributes 504s (set1 257 + set2 247), per HOLDS workout A.
    expect(rem0 - rem1).toBe(504);
  });

  it("handles a mid-set hanging state correctly", () => {
    // Hold 0, set 1, rep 3 (4th rep), hanging, 2s into a 7s hang.
    const s: SessionState = { phase: "hanging", holdIndex: 0, setNumber: 1, repIndex: 3 };
    // Remaining of current set after this hang ends:
    //   3 more (hang+rest) for reps 4,5,6 = 3*(HANG+REST) — wait, last rep has no trailing rest.
    //   Actually after rep 3 hang: rest, hang, rest, hang, rest, hang, break = 3 rests + 3 hangs + break
    //   = 3*REST + 3*HANG + BREAK = 9 + 21 + 180 = 210
    // Plus set 2 (247) plus 7 more holds (7 * 504 = 3528) = 210 + 247 + 3528 = 3985
    // Plus currentPhaseRemaining = 5.
    expect(remainingWorkoutSecs(s, HOLDS, S1, S2, 5)).toBe(5 + 210 + 247 + 7 * 504);
  });
});
