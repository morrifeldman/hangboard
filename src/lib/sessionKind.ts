import type { SessionRecord } from "./history";

/** The one definition of "this was a hangboard workout" (as opposed to a gym log). */
export const HANGBOARD_WORKOUT_TYPES = ["repeaters", "max-hang", "beginner"] as const;

export type HangboardWorkoutType = (typeof HANGBOARD_WORKOUT_TYPES)[number];
export type SessionKind = "hangboard" | "gym" | "cardio" | "stretching";

export function isHangboardType(workoutType: string): workoutType is HangboardWorkoutType {
  return (HANGBOARD_WORKOUT_TYPES as readonly string[]).includes(workoutType);
}

/** Decided by `workoutType` alone, never by the presence of `gymData`. */
export function isHangboardSession(s: Pick<SessionRecord, "workoutType">): boolean {
  return isHangboardType(s.workoutType);
}

export function sessionKind(s: Pick<SessionRecord, "workoutType">): SessionKind {
  if (isHangboardType(s.workoutType)) return "hangboard";
  if (s.workoutType === "cardio") return "cardio";
  if (s.workoutType === "stretching") return "stretching";
  return "gym";
}
