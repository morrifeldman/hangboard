import type { GymWorkoutType } from "../lib/history";

export type FieldType = "number" | "text" | "grade-v" | "grade-yds" | "select";

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
    label: "PE Route Intervals",
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
    label: "Performance",
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
    label: "Hard Bouldering",
    description: "Just above flash level, 2–3 problems, 3–4 quality attempts per problem. 2–5 min rest between attempts",
    category: "performance",
    fieldDefs: [
      { key: "level",       label: "Level",    type: "grade-v" },
      { key: "durationMin", label: "Duration", type: "number", unit: "min" },
    ],
  },
  {
    id: "limit-bouldering",
    label: "Limit Bouldering",
    description: "2–4 \"realistic\" problems, 4–5 quality attempts per problem. 2–5 min rest between attempts, 5–10 min rest between problems",
    category: "performance",
    fieldDefs: [
      { key: "level",       label: "Level",    type: "grade-v" },
      { key: "durationMin", label: "Duration", type: "number", unit: "min" },
    ],
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
];
