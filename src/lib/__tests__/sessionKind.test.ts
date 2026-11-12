import { describe, it, expect } from "vitest";
import { GYM_WORKOUT_TYPES } from "../history";
import { GYM_LABELS } from "../historyFilter";
import { GYM_WORKOUTS } from "../../data/gymWorkouts";
import {
  ACTIVITY_CATEGORIES,
  HANGBOARD_WORKOUT_TYPES,
  climbCategory,
  climbFocus,
  isActivitySession,
  isHangboardSession,
  sessionCategory,
  sessionFocuses,
  workoutTypeFocus,
} from "../sessionKind";

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

  it("keeps non-climbing work out of climbing, with no climbing focus", () => {
    expect(sessionCategory({ workoutType: "lifts" })).toBe("lifting");
    expect(sessionCategory({ workoutType: "cardio" })).toBe("cardio");
    expect(sessionCategory({ workoutType: "stretching" })).toBe("stretching");
    expect(sessionCategory({ workoutType: "freeform" })).toBe("other");
    expect(sessionCategory({ workoutType: "injury" })).toBe("other");
    for (const workoutType of ["lifts", "cardio", "stretching", "freeform", "injury"] as const) {
      expect(sessionFocuses({ workoutType })).toEqual([]);
    }
  });

  it("only an injury is a log entry rather than activity", () => {
    for (const t of [...HANGBOARD_WORKOUT_TYPES, ...GYM_WORKOUT_TYPES]) {
      expect(isActivitySession({ workoutType: t })).toBe(t !== "injury");
    }
  });

  it("only indoor climbing types carry a focus", () => {
    for (const t of [...HANGBOARD_WORKOUT_TYPES, ...GYM_WORKOUT_TYPES]) {
      if (workoutTypeFocus(t)) expect(sessionCategory({ workoutType: t })).toBe("indoor");
    }
    expect(workoutTypeFocus("max-hang")).toBe("power");
    expect(workoutTypeFocus("repeaters")).toBe("endurance");
    expect(workoutTypeFocus("wbl")).toBeUndefined();
  });

  it("classifies logged routes by setting and type", () => {
    expect(climbCategory({ setting: "outdoor" })).toBe("outdoor");
    expect(climbCategory({ setting: "indoor" })).toBe("indoor");
    expect(climbFocus({ type: "boulder" })).toBe("power");
    expect(climbFocus({ type: "sport" })).toBe("endurance");
  });

  it("lists each category once", () => {
    const ids = ACTIVITY_CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every gym workout type has a label and a definition", () => {
    for (const t of GYM_WORKOUT_TYPES) {
      expect(GYM_LABELS[t]).toBeTruthy();
      expect(GYM_WORKOUTS.some((w) => w.id === t)).toBe(true);
    }
  });
});
