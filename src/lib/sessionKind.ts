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

/**
 * What a climbing session trains. These are specific training terms (The Rock
 * Climber's Training Manual; stamina is The Self-Coached Climber's), not loose
 * descriptions: a session has a focus only when it is that kind of training.
 * Plenty of climbing has none — a warm-up ladder, a performance day, a logged
 * route — and nothing outside climbing ever has one. Bench press is lifting,
 * not climbing strength.
 */
export type ClimbingFocus = "endurance" | "stamina" | "strength" | "power" | "power-endurance";

/** Display order: the order a training cycle runs through them. */
export const CLIMBING_FOCUSES = [
  { id: "endurance",       label: "Endurance" },
  { id: "stamina",         label: "Stamina" },
  { id: "strength",        label: "Strength" },
  { id: "power",           label: "Power" },
  { id: "power-endurance", label: "Power endurance" },
] as const satisfies readonly { id: ClimbingFocus; label: string }[];

type WorkoutType = SessionRecord["workoutType"];

type WorkoutClass = {
  category: ActivityCategory;
  /** The climbing quality this type trains, if it is that specific. */
  focus?: ClimbingFocus;
  /** A log entry rather than something you did: no calendar colour, no effect on a rest day. */
  logOnly?: true;
};

const WORKOUT_CLASS: Record<WorkoutType, WorkoutClass> = {
  // Endurance: aerobic base.
  "arc":              { category: "indoor", focus: "endurance" },
  // Stamina: climbing all day without getting pumped.
  "cir":              { category: "indoor", focus: "stamina" },
  // Strength: the hangboard.
  "repeaters":        { category: "indoor", focus: "strength" },
  "max-hang":         { category: "indoor", focus: "strength" },
  // Power.
  "campus":           { category: "indoor", focus: "power" },
  "limit-bouldering": { category: "indoor", focus: "power" },
  "hard-bouldering":  { category: "indoor", focus: "power" },
  // Power endurance: linked boulder circuits and route intervals.
  "lbc":              { category: "indoor", focus: "power-endurance" },
  "pe-route":         { category: "indoor", focus: "power-endurance" },
  // Climbing that isn't one of the above.
  "wbl":              { category: "indoor" },
  "performance":      { category: "indoor" },
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

/** The climbing quality a session trained, or undefined when it has no specific focus. */
export function sessionFocus(s: Pick<SessionRecord, "workoutType">): ClimbingFocus | undefined {
  return workoutTypeFocus(s.workoutType);
}

/**
 * A logged route is indoor or outdoor climbing, by where it was climbed. It has
 * no training focus: going climbing is not a power or endurance workout.
 */
export function climbCategory(c: Pick<ClimbRecord, "setting">): "outdoor" | "indoor" {
  return c.setting === "outdoor" ? "outdoor" : "indoor";
}

// ─── Hangboard ────────────────────────────────────────────────────────────────

/** The one definition of "this was a hangboard workout" (as opposed to a gym log). */
export const HANGBOARD_WORKOUT_TYPES = ["repeaters", "max-hang"] as const;

export type HangboardWorkoutType = (typeof HANGBOARD_WORKOUT_TYPES)[number];

export function isHangboardType(workoutType: string): workoutType is HangboardWorkoutType {
  return (HANGBOARD_WORKOUT_TYPES as readonly string[]).includes(workoutType);
}

/** Decided by `workoutType` alone, never by the presence of `gymData`. */
export function isHangboardSession(s: Pick<SessionRecord, "workoutType">): boolean {
  return isHangboardType(s.workoutType);
}
