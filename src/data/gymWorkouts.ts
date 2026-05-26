import type { GymWorkoutType, CampusSet } from "../lib/history";

export type FieldType = "number" | "text" | "grade-v" | "grade-yds" | "select" | "multi-select";

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  unit?: string;
  optional?: boolean;
  options?: string[];
};

export type GymWorkoutDef = {
  id: GymWorkoutType;
  label: string;
  description: string;
  category: "endurance" | "power" | "performance";
  fieldDefs: FieldDef[];
};

export const GYM_WORKOUTS: GymWorkoutDef[] = [
  {
    id: "arc",
    label: "ARC",
    description: "Aerobic Restoration & Capillarity — continuous climbing",
    category: "endurance",
    fieldDefs: [
      { key: "climbMin",   label: "Climbing time", type: "number", unit: "min" },
      { key: "routes",    label: "Routes",        type: "number", optional: true },
      { key: "downclimb", label: "Downclimb",     type: "select", options: ["Yes", "No"], optional: true },
      { key: "wallMin",   label: "Session time",  type: "number", unit: "min", optional: true },
      { key: "maxGrade",  label: "Max grade",     type: "grade-yds", optional: true },
    ],
  },
  {
    id: "cir",
    label: "CIR",
    description: "Continuous-Intensity Repetitions",
    category: "endurance",
    fieldDefs: [
      { key: "repeats",     label: "Repeats",        type: "number" },
      { key: "climbRating", label: "Climb rating",   type: "grade-yds", optional: true },
      { key: "avgRestSec",  label: "Avg rest",        type: "number", unit: "sec" },
    ],
  },
  {
    id: "pe-route",
    label: "PE Intervals",
    description: "High intensity power endurance training. Target ~1 letter grade above current onsight grade",
    category: "power",
    fieldDefs: [
      { key: "climbSec",  label: "Climb time",  type: "number", unit: "sec" },
      { key: "dutyCycle", label: "Duty cycle",    type: "select", options: ["1:1", "1:1.5", "1:2"] },
      { key: "reps",      label: "Reps",         type: "number" },
    ],
  },
  {
    id: "lbc",
    label: "LBC",
    description: "Linked Boulder Circuit — high intensity power endurance training",
    category: "power",
    fieldDefs: [
      { key: "climbSec",      label: "Climb time",     type: "number", unit: "sec" },
      { key: "dutyCycle",     label: "Duty cycle",       type: "select", options: ["1:1", "1:1.5", "1:2"] },
      { key: "sets", label: "Sets", type: "number" },
    ],
  },
  {
    id: "performance",
    label: "Perf",
    description: "Projecting specific grades",
    category: "performance",
    fieldDefs: [
      { key: "grade",   label: "Grade",   type: "grade-yds" },
      { key: "tries",   label: "Tries",   type: "number" },
      { key: "success", label: "Success", type: "select", options: ["Yes", "No"] },
    ],
  },
  {
    id: "wbl",
    label: "WBL",
    description: "Warmup Boulder Ladder — 1–3 problems at each grade up to flash level. No more than 3 attempts per problem",
    category: "performance",
    fieldDefs: [
      { key: "topV",        label: "Top grade",    type: "grade-v" },
      { key: "durationMin", label: "Duration",     type: "number", unit: "min" },
    ],
  },
  {
    id: "hard-bouldering",
    label: "Hard Boulder",
    description: "Just above flash level, 2–3 problems, 3–4 quality attempts per problem. 2–5 min rest between attempts",
    category: "performance",
    fieldDefs: [
      { key: "level",       label: "Level",    type: "grade-v" },
      { key: "durationMin", label: "Duration", type: "number", unit: "min" },
    ],
  },
  {
    id: "limit-bouldering",
    label: "Limit Boulder",
    description: "2–4 \"realistic\" problems, 4–5 quality attempts per problem. 2–5 min rest between attempts, 5–10 min rest between problems",
    category: "performance",
    fieldDefs: [
      { key: "level",       label: "Level",    type: "grade-v" },
      { key: "durationMin", label: "Duration", type: "number", unit: "min" },
    ],
  },
  {
    id: "campus",
    label: "Campus",
    description:
      "Campus board — Metolius/Moon rung spacing. Each row is a set: pick rung size, ladder name, and hand sequence (B=both, L=left, R=right; number = rung). Starts from the standard routine — edit, add, or reset rows.",
    category: "power",
    fieldDefs: [], // custom row editor, like freeform
  },
  {
    id: "injury",
    label: "Injury",
    description: "Log an injury or pain event",
    category: "performance",
    fieldDefs: [
      { key: "bodyPart", label: "Body part", type: "text", optional: true },
      { key: "severity", label: "Severity",  type: "select", options: ["Mild", "Moderate", "Severe"], optional: true },
    ],
  },
  {
    id: "cardio",
    label: "Cardio",
    description: "Bike, run, or elliptical — zone 2 / aerobic conditioning",
    category: "endurance",
    fieldDefs: [
      { key: "mode",        label: "Mode",      type: "select", options: ["Bike", "Run", "Elliptical"] },
      { key: "durationMin", label: "Duration",  type: "number", unit: "min" },
      { key: "intensity",   label: "Intensity", type: "select", options: ["Easy", "Moderate", "Hard"], optional: true },
    ],
  },
  {
    id: "stretching",
    label: "Stretch",
    description: "Mobility / flexibility work",
    category: "performance",
    fieldDefs: [
      { key: "stretches", label: "Stretches", type: "multi-select",
        options: ["Hamstrings", "Quads", "Adductors", "IT band", "Calves", "Forearms"], optional: true },
      { key: "reps", label: "Reps per stretch", type: "number", optional: true },
      { key: "holdSec", label: "Hold time", type: "number", unit: "sec", optional: true },
    ],
  },
  {
    id: "freeform",
    label: "Freeform",
    description: "Free-form workout — title, sections, key/value entries",
    category: "performance",
    fieldDefs: [],
  },
];

// ─── Campus board dropdown options + default routine ───────────────────────────

export const CAMPUS_RUNGS = ["Large", "Medium", "Small"];
export const CAMPUS_NAMES = ["Matching Ladder", "Basic Ladder", "Max Ladder"];

/**
 * Preset hand sequences grouped by ladder name. The sequence field also allows
 * free entry, and previously-logged sequences are merged in at runtime — so
 * Max Ladder (and the rest) stay extensible.
 */
export const CAMPUS_SEQUENCES: Record<string, string[]> = {
  "Matching Ladder": ["B1-L2-R2-L3-R3-L4-B4", "B1-R2-L2-R3-L3-R4-B4"],
  "Basic Ladder": ["B1-L2-R3-L4-R5-L6-B6", "B1-R2-L3-R4-L5-R6-B6"],
  "Max Ladder": ["B1-L3-R4-B4", "B1-R3-L4-B4", "B1-L3-R5-B5", "B1-R3-L5-B5"],
};

/** Standard campus routine, pre-seeded into a new Campus log. */
export const CAMPUS_TEMPLATE: CampusSet[] = [
  { rung: "Large",  name: "Matching Ladder", sequence: "B1-L2-R2-L3-R3-L4-B4" },
  { rung: "Large",  name: "Matching Ladder", sequence: "B1-R2-L2-R3-L3-R4-B4" },
  { rung: "Medium", name: "Matching Ladder", sequence: "B1-L2-R2-L3-R3-L4-B4" },
  { rung: "Medium", name: "Matching Ladder", sequence: "B1-R2-L2-R3-L3-R4-B4" },
  { rung: "Large",  name: "Basic Ladder",    sequence: "B1-L2-R3-L4-R5-L6-B6" },
  { rung: "Large",  name: "Basic Ladder",    sequence: "B1-R2-L3-R4-L5-R6-B6" },
  { rung: "Medium", name: "Basic Ladder",    sequence: "B1-L2-R3-L4-R5-L6-B6" },
  { rung: "Medium", name: "Basic Ladder",    sequence: "B1-R2-L3-R4-L5-R6-B6" },
  { rung: "Medium", name: "Max Ladder",      sequence: "B1-L3-R4-B4" },
  { rung: "Medium", name: "Max Ladder",      sequence: "B1-R3-L4-B4" },
  { rung: "Medium", name: "Max Ladder",      sequence: "B1-L3-R5-B5" },
  { rung: "Medium", name: "Max Ladder",      sequence: "B1-R3-L5-B5" },
];

/** Display the ladder name without the trailing "Ladder" word (stored value keeps it). */
export function ladderDisplayName(name: string): string {
  return name.replace(/\s*Ladder$/i, "");
}

/** One-letter rung label for the compact campus row (stored value keeps "Large" etc.). */
export function rungShortLabel(rung: string): string {
  return rung ? rung.charAt(0).toUpperCase() : "";
}

/**
 * Compact, meaningful label for a hand sequence.
 * Consecutive ladders show lead hand + top rung (how high they go):
 *   B1-L2-R2-L3-R3-L4-B4  → "L4"       (matching ladder to rung 4)
 *   B1-R2-L3-R4-L5-R6-B6  → "R6"       (basic ladder to rung 6)
 * Ladders with skips show lead hand + every gap (kept verbatim, including zeros):
 *   B1-L3-R4-B4           → "L+1+0"    (lead left, skip a rung then adjacent)
 *   B1-L3-R5-B5           → "L+1+1"    (lead left, skip then skip)
 * Non-ladder / unparseable sequences fall back to the raw string.
 */
export function sequenceShortLabel(seq: string): string {
  const tokens = seq.split("-").map((t) => t.trim()).filter(Boolean);
  const parsed = tokens
    .map((t) => /^([BLR])(\d+)$/i.exec(t))
    .filter((m): m is RegExpExecArray => m !== null);
  if (parsed.length !== tokens.length || tokens.length === 0) return seq;

  const lead = parsed.find((m) => m[1].toUpperCase() !== "B");
  if (!lead) return seq;
  const hand = lead[1].toUpperCase();

  const rungs = Array.from(new Set(parsed.map((m) => Number(m[2])))).sort((a, b) => a - b);
  const skips: number[] = [];
  for (let i = 1; i < rungs.length; i++) skips.push(rungs[i] - rungs[i - 1] - 1);
  // Consecutive ladder (no rung ever skipped) → report top rung; otherwise list every gap.
  return skips.every((s) => s === 0)
    ? `${hand}${rungs[rungs.length - 1]}`
    : hand + skips.map((s) => `+${s}`).join("");
}

/**
 * Expand a short code typed into "+ Custom…" back into a full B/L/R sequence.
 * Inverse of {@link sequenceShortLabel} for the two short forms:
 *   "R+1+2" → "B1-R3-L6-B6"   (lead right, skip 1 then skip 2)
 *   "L4"    → "B1-L2-R3-L4-B4" (lead left, consecutive ladder to rung 4)
 * Returns null if the string isn't a recognized short code (caller then keeps it verbatim).
 */
export function shortCodeToSequence(code: string): string | null {
  const t = code.trim();
  let rungs: number[];
  let m: RegExpExecArray | null;
  if ((m = /^([LR])((?:\+\d+)+)$/i.exec(t))) {
    const skips = m[2].split("+").filter(Boolean).map(Number);
    rungs = [1];
    for (const s of skips) rungs.push(rungs[rungs.length - 1] + s + 1);
  } else if ((m = /^([LR])(\d+)$/i.exec(t))) {
    const top = Number(m[2]);
    if (top < 2) return null;
    rungs = Array.from({ length: top }, (_, k) => k + 1);
  } else {
    return null;
  }
  if (rungs.length < 2) return null;

  const lead = m[1].toUpperCase();
  const tokens = [`B${rungs[0]}`];
  let hand = lead;
  for (let k = 1; k < rungs.length; k++) {
    tokens.push(`${hand}${rungs[k]}`);
    hand = hand === "L" ? "R" : "L";
  }
  tokens.push(`B${rungs[rungs.length - 1]}`);
  return tokens.join("-");
}
