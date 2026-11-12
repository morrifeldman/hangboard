import type { SessionRecord } from "./history";
import type { ClimbRecord } from "./climbs";

/**
 * The one taxonomy for everything the app logs. The picker, History, the
 * Activity calendar and the Schedule all read it from here, so a type can't be
 * "power" in one place and "strength" in another.
 *
 * Two rules it exists to keep:
 * - Climbing and non-climbing never mix. Lifting, cardio and stretching are
 *   their own categories and carry no climbing focus.
 * - Indoor and outdoor climbing are separate categories. Indoor covers the
 *   climbing gym, the hangboard and indoor route logs; outdoor is only route
 *   logs made outside.
 */
export type ActivityCategory = "outdoor" | "indoor" | "lifting" | "cardio" | "stretching" | "other";

/** Display order everywhere a list of categories is shown. */
export const ACTIVITY_CATEGORIES = [
  { id: "outdoor",    label: "Outdoor climbing", color: "bg-teal-600" },
  { id: "indoor",     label: "Indoor climbing",  color: "bg-amber-500" },
  { id: "lifting",    label: "Lifting",          color: "bg-sky-500" },
  { id: "cardio",     label: "Cardio",           color: "bg-rose-500" },
  { id: "stretching", label: "Stretching",       color: "bg-violet-500" },
  { id: "other",      label: "Other",            color: "bg-gray-500" },
] as const satisfies readonly { id: ActivityCategory; label: string; color: string }[];

/** What a climbing session trains. Only climbing has a focus. */
export type ClimbingFocus = "endurance" | "power";

type WorkoutType = SessionRecord["workoutType"];

type WorkoutClass = {
  category: ActivityCategory;
  /** Fixed focus of the type, if it has one. */
  focus?: ClimbingFocus;
  /** A log entry rather than something you did: no calendar colour, no effect on a rest day. */
  logOnly?: true;
};

const WORKOUT_CLASS: Record<WorkoutType, WorkoutClass> = {
  // Hangboard: indoor climbing training.
  "repeaters":        { category: "indoor", focus: "endurance" },
  "max-hang":         { category: "indoor", focus: "power" },
  "beginner":         { category: "indoor" },
  // Climbing gym.
  "arc":              { category: "indoor", focus: "endurance" },
  "cir":              { category: "indoor", focus: "endurance" },
  "pe-route":         { category: "indoor", focus: "endurance" },
  "lbc":              { category: "indoor", focus: "endurance" },
  "hard-bouldering":  { category: "indoor", focus: "power" },
  "limit-bouldering": { category: "indoor", focus: "power" },
  "performance":      { category: "indoor", focus: "power" },
  "campus":           { category: "indoor", focus: "power" },
  // A warm-up ladder, and unstructured climbing whose focus depends on the discipline.
  "wbl":              { category: "indoor" },
  "climbing":         { category: "indoor" },
  // Not climbing.
  "lifts":            { category: "lifting" },
  "cardio":           { category: "cardio" },
  "stretching":       { category: "stretching" },
  "freeform":         { category: "other" },
  "injury":           { category: "other", logOnly: true },
};

const classOf = (workoutType: string): WorkoutClass =>
  (WORKOUT_CLASS as Record<string, WorkoutClass | undefined>)[workoutType] ?? { category: "other" };

/** Category of a workout type. Unknown types (e.g. from a newer backup) are "other". */
export function workoutTypeCategory(workoutType: string): ActivityCategory {
  return classOf(workoutType).category;
}

/** The fixed focus of a workout type, or undefined when it has none. */
export function workoutTypeFocus(workoutType: string): ClimbingFocus | undefined {
  return classOf(workoutType).focus;
}

export function sessionCategory(s: Pick<SessionRecord, "workoutType">): ActivityCategory {
  return workoutTypeCategory(s.workoutType);
}

/** False for log entries (an injury) that record something other than activity. */
export function isActivitySession(s: Pick<SessionRecord, "workoutType">): boolean {
  return !classOf(s.workoutType).logOnly;
}

/**
 * What a session trained. Unstructured climbing goes by discipline: bouldering
 * is power, rope is endurance, mixed is both. Non-climbing sessions train neither.
 */
export function sessionFocuses(s: Pick<SessionRecord, "workoutType" | "gymData">): ClimbingFocus[] {
  if (s.gymData?.type === "climbing") {
    const d = s.gymData.discipline;
    if (d === "Boulder") return ["power"];
    if (d === "Rope") return ["endurance"];
    if (d === "Mixed") return ["endurance", "power"];
    return [];
  }
  const focus = workoutTypeFocus(s.workoutType);
  return focus ? [focus] : [];
}

/** A logged route is indoor or outdoor climbing, by where it was climbed. */
export function climbCategory(c: Pick<ClimbRecord, "setting">): "outdoor" | "indoor" {
  return c.setting === "outdoor" ? "outdoor" : "indoor";
}

/** Boulders train power, routes train endurance — indoors or out. */
export function climbFocus(c: Pick<ClimbRecord, "type">): ClimbingFocus {
  return c.type === "boulder" ? "power" : "endurance";
}

// ─── Hangboard ────────────────────────────────────────────────────────────────

/** The one definition of "this was a hangboard workout" (as opposed to a gym log). */
export const HANGBOARD_WORKOUT_TYPES = ["repeaters", "max-hang", "beginner"] as const;

export type HangboardWorkoutType = (typeof HANGBOARD_WORKOUT_TYPES)[number];

export function isHangboardType(workoutType: string): workoutType is HangboardWorkoutType {
  return (HANGBOARD_WORKOUT_TYPES as readonly string[]).includes(workoutType);
}

/** Decided by `workoutType` alone, never by the presence of `gymData`. */
export function isHangboardSession(s: Pick<SessionRecord, "workoutType">): boolean {
  return isHangboardType(s.workoutType);
}
