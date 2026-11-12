import type { SessionRecord, GymData, GymWorkoutType } from "./history";
import {
  ACTIVITY_CATEGORIES,
  HANGBOARD_WORKOUT_TYPES,
  isHangboardType,
  workoutTypeCategory,
  type ActivityCategory,
} from "./sessionKind";
import type { ClimbRecord } from "./climbs";
import type { NoteRecord } from "./notes";

// ─── Workout type labels ──────────────────────────────────────────────────────

export const GYM_LABELS: Record<GymWorkoutType, string> = {
  "arc":              "ARC",
  "cir":              "CIR",
  "pe-route":         "PE Route Intervals",
  "lbc":              "LBC",
  "performance":      "Performance",
  "wbl":              "WBL",
  "hard-bouldering":  "Hard Bouldering",
  "limit-bouldering": "Limit Bouldering",
  "campus":           "Campus",
  "injury":           "Injury",
  "cardio":           "Cardio",
  "stretching":       "Stretching",
  "freeform":         "Freeform",
  "lifts":            "Lifts",
  "climbing":         "Climbing",
};

const HANGBOARD_LABELS: Record<(typeof HANGBOARD_WORKOUT_TYPES)[number], string> = {
  "repeaters": "Repeaters",
  "max-hang":  "Max Hang",
  "beginner":  "Beginner",
};

export function workoutTypeLabel(workoutType: string): string {
  const labels: Record<string, string> = { ...HANGBOARD_LABELS, ...GYM_LABELS };
  return labels[workoutType] ?? workoutType;
}

export function workoutLabel(record: SessionRecord): string {
  return workoutTypeLabel(record.workoutType);
}

// ─── Data-driven subcategory chips ───────────────────────────────────────────

/** Count sessions per workoutType. */
export function workoutTypeCounts(sessions: SessionRecord[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const s of sessions) {
    counts.set(s.workoutType, (counts.get(s.workoutType) ?? 0) + 1);
  }
  return counts;
}

/**
 * Chip groups for the Workouts sub-filter, one per activity category in display
 * order, restricted to types present in history. Within a group the hangboard
 * types come first (fixed order), then the rest most-used first.
 */
export function workoutTypeGroups(
  sessions: SessionRecord[],
): { category: ActivityCategory; types: string[] }[] {
  const counts = workoutTypeCounts(sessions);
  const hangboard: string[] = HANGBOARD_WORKOUT_TYPES.filter((t) => counts.has(t));
  const rest = [...counts.entries()]
    .filter(([t]) => !isHangboardType(t))
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t);
  const present = [...hangboard, ...rest];
  return ACTIVITY_CATEGORIES.map((c) => ({
    category: c.id as ActivityCategory,
    types: present.filter((t) => workoutTypeCategory(t) === c.id),
  })).filter((g) => g.types.length > 0);
}

// ─── Free-text search ────────────────────────────────────────────────────────

export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

function has(haystack: string | undefined, q: string): boolean {
  return haystack !== undefined && haystack.toLowerCase().includes(q);
}

/** Collect the searchable string values inside a GymData record. */
function gymDataStrings(data: GymData): string[] {
  const out: string[] = [];
  const walk = (value: unknown): void => {
    if (typeof value === "string") out.push(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value !== null && typeof value === "object") {
      for (const v of Object.values(value)) walk(v);
    }
  };
  for (const [key, value] of Object.entries(data)) {
    if (key === "type") continue;
    walk(value);
  }
  return out;
}

/** q must already be normalized (normalizeQuery); empty q matches everything. */
export function sessionMatchesQuery(record: SessionRecord, q: string): boolean {
  if (q === "") return true;
  if (has(workoutLabel(record), q)) return true;
  if (has(record.notes, q)) return true;
  for (const hold of record.holds) {
    if (has(hold.holdName, q)) return true;
    if (has(hold.notes, q)) return true;
    if (has(hold.set1.notes, q)) return true;
    if (has(hold.set2?.notes, q)) return true;
    if (has(hold.set3?.notes, q)) return true;
  }
  if (record.gymData && gymDataStrings(record.gymData).some((s) => has(s, q))) return true;
  return false;
}

export function climbMatchesQuery(c: ClimbRecord, q: string): boolean {
  if (q === "") return true;
  return (
    has(c.route, q) ||
    has(c.grade, q) ||
    has(c.location, q) ||
    has(c.notes, q) ||
    has(c.style, q) ||
    has(c.type, q) ||
    has(c.setting, q)
  );
}

export function noteMatchesQuery(n: NoteRecord, q: string): boolean {
  if (q === "") return true;
  return has(n.text, q) || has(n.category, q);
}
