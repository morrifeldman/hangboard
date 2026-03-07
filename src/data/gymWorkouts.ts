import type { GymWorkoutType } from "../lib/history";

export type FieldType = "number" | "text" | "grade-v" | "grade-yds";

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  unit?: string;
  optional?: boolean;
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
      { key: "climbMin",  label: "Climbing time", type: "number", unit: "min" },
      { key: "wallMin",   label: "Session time",  type: "number", unit: "min", optional: true },
      { key: "maxGrade",  label: "Max grade",     type: "grade-yds", optional: true },
    ],
  },
  {
    id: "cir",
    label: "CIR",
    description: "Climbing Interval Repeaters",
    category: "endurance",
    fieldDefs: [
      { key: "repeats",     label: "Repeats",        type: "number" },
      { key: "climbRating", label: "Climb rating",   type: "grade-yds", optional: true },
      { key: "avgRestSec",  label: "Avg rest",        type: "number", unit: "sec" },
    ],
  },
  {
    id: "power-endurance",
    label: "Power Endurance",
    description: "High-intensity linked bouldering",
    category: "power",
    fieldDefs: [
      { key: "climbSec", label: "Climb time", type: "number", unit: "sec" },
      { key: "restSec",  label: "Rest time",  type: "number", unit: "sec" },
      { key: "reps",     label: "Reps",       type: "number" },
    ],
  },
  {
    id: "4x4",
    label: "4×4",
    description: "4 problems × 4 rounds",
    category: "power",
    fieldDefs: [
      { key: "climbSec",      label: "Climb time",   type: "number", unit: "sec" },
      { key: "restSec",       label: "Rest time",    type: "number", unit: "sec" },
      { key: "completed4x4s", label: "Completed 4×4s", type: "number" },
    ],
  },
  {
    id: "performance",
    label: "Performance",
    description: "Projecting specific grades",
    category: "performance",
    fieldDefs: [
      { key: "grade", label: "Grade",  type: "grade-yds" },
      { key: "tries", label: "Tries",  type: "number" },
      { key: "sends", label: "Sends",  type: "number" },
    ],
  },
  {
    id: "boulder-ladder",
    label: "Boulder Ladder",
    description: "Progressive difficulty ladder session",
    category: "performance",
    fieldDefs: [
      { key: "topV",        label: "Top grade",    type: "grade-v" },
      { key: "durationMin", label: "Duration",     type: "number", unit: "min" },
    ],
  },
  {
    id: "hard-bouldering",
    label: "Hard Bouldering",
    description: "Submaximal hard problems",
    category: "performance",
    fieldDefs: [
      { key: "level",       label: "Level",    type: "grade-v" },
      { key: "durationMin", label: "Duration", type: "number", unit: "min" },
    ],
  },
  {
    id: "limit-bouldering",
    label: "Limit Bouldering",
    description: "Max effort limit problems",
    category: "performance",
    fieldDefs: [
      { key: "level",       label: "Level",    type: "grade-v" },
      { key: "durationMin", label: "Duration", type: "number", unit: "min" },
    ],
  },
];
