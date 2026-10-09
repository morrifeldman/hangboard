import { describe, it, expect } from "vitest";
import { GYM_WORKOUT_TYPES } from "../history";
import { GYM_LABELS } from "../historyFilter";
import { GYM_WORKOUTS } from "../../data/gymWorkouts";
import { HANGBOARD_WORKOUT_TYPES, isHangboardSession, sessionKind } from "../sessionKind";

describe("sessionKind", () => {
  it("classifies hangboard types by workoutType", () => {
    for (const workoutType of HANGBOARD_WORKOUT_TYPES) {
      expect(sessionKind({ workoutType })).toBe("hangboard");
      expect(isHangboardSession({ workoutType })).toBe(true);
    }
  });

  it("classifies cardio, stretching and everything else", () => {
    expect(sessionKind({ workoutType: "cardio" })).toBe("cardio");
    expect(sessionKind({ workoutType: "stretching" })).toBe("stretching");
    for (const workoutType of ["arc", "lifts", "campus", "freeform", "injury"] as const) {
      expect(sessionKind({ workoutType })).toBe("gym");
      expect(isHangboardSession({ workoutType })).toBe(false);
    }
  });

  it("every gym workout type has a label and a definition", () => {
    for (const t of GYM_WORKOUT_TYPES) {
      expect(GYM_LABELS[t]).toBeTruthy();
      expect(GYM_WORKOUTS.some((w) => w.id === t)).toBe(true);
    }
  });
});
