import { describe, it, expect } from "vitest";
import { GYM_WORKOUT_TYPES } from "../history";
import { GYM_LABELS } from "../historyFilter";
import { GYM_WORKOUTS } from "../../data/gymWorkouts";
import {
  ACTIVITY_CATEGORIES,
  CLIMBING_FOCUSES,
  HANGBOARD_WORKOUT_TYPES,
  climbCategory,
  isActivitySession,
  isHangboardSession,
  sessionCategory,
  sessionFocus,
  workoutTypeFocus,
} from "../sessionKind";

const ALL_TYPES = [...HANGBOARD_WORKOUT_TYPES, ...GYM_WORKOUT_TYPES];

describe("activity taxonomy", () => {
  it("puts hangboard and climbing-gym work under indoor climbing", () => {
    for (const workoutType of HANGBOARD_WORKOUT_TYPES) {
      expect(sessionCategory({ workoutType })).toBe("indoor");
      expect(isHangboardSession({ workoutType })).toBe(true);
    }
    for (const workoutType of ["arc", "campus", "wbl", "performance", "climbing"] as const) {
      expect(sessionCategory({ workoutType })).toBe("indoor");
      expect(isHangboardSession({ workoutType })).toBe(false);
    }
  });

  it("gives each focused climbing type its specific focus", () => {
    const expected: Record<string, string | undefined> = {
      "arc": "endurance",
      "cir": "stamina",
      "repeaters": "strength",
      "max-hang": "strength",
      "campus": "power",
      "limit-bouldering": "power",
      "hard-bouldering": "power",
      "lbc": "power-endurance",
      "pe-route": "power-endurance",
      // Climbing that doesn't fit a focus.
      "wbl": undefined,
      "performance": undefined,
      "climbing": undefined,
    };
    for (const [t, focus] of Object.entries(expected)) expect(workoutTypeFocus(t)).toBe(focus);
  });

  it("never gives non-climbing work a climbing focus", () => {
    expect(sessionCategory({ workoutType: "lifts" })).toBe("lifting");
    expect(sessionCategory({ workoutType: "cardio" })).toBe("cardio");
    expect(sessionCategory({ workoutType: "stretching" })).toBe("stretching");
    expect(sessionCategory({ workoutType: "freeform" })).toBe("other");
    expect(sessionCategory({ workoutType: "injury" })).toBe("other");
    for (const t of ALL_TYPES) {
      if (sessionFocus({ workoutType: t })) expect(sessionCategory({ workoutType: t })).toBe("indoor");
    }
  });

  it("only an injury is a log entry rather than activity", () => {
    for (const t of ALL_TYPES) {
      expect(isActivitySession({ workoutType: t })).toBe(t !== "injury");
    }
  });

  it("classifies logged routes by setting", () => {
    expect(climbCategory({ setting: "outdoor" })).toBe("outdoor");
    expect(climbCategory({ setting: "indoor" })).toBe("indoor");
  });

  it("lists each category and focus once, and uses every focus", () => {
    const ids = ACTIVITY_CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of CLIMBING_FOCUSES) {
      expect(ALL_TYPES.some((t) => workoutTypeFocus(t) === f.id)).toBe(true);
    }
  });

  it("every gym workout type has a label and a definition", () => {
    for (const t of GYM_WORKOUT_TYPES) {
      expect(GYM_LABELS[t]).toBeTruthy();
      expect(GYM_WORKOUTS.some((w) => w.id === t)).toBe(true);
    }
  });
});
