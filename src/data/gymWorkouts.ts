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
        options: ["Hamstrings", "Quads", "Adductors", "IT band", "Calves"], optional: true },
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
