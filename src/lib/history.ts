import type { HoldDefinition } from "../data/holds";
import { numSetsOf, repsFor } from "../data/holds";
import { setKey } from "./stateMachine";
import { recordStore } from "./db";
import type { LiftEntry } from "./lifts";

// ─── Types ───────────────────────────────────────────────────────────────────

export const GYM_WORKOUT_TYPES = [
  "arc", "cir", "pe-route", "lbc", "wbl",
  "performance", "hard-bouldering", "limit-bouldering", "campus", "injury",
  "cardio", "stretching", "freeform", "lifts",
] as const;

export type GymWorkoutType = (typeof GYM_WORKOUT_TYPES)[number];

export type FreeformEntry = { key: string; value: string };
export type FreeformSection = { name: string; entries: FreeformEntry[] };

/** One campus-board set row: rung size + ladder name + hand sequence + optional note. */
export type CampusSet = { rung: string; name: string; sequence: string; note?: string };

export type GymData =
  | { type: "arc";              climbMin: number; routes?: number; downclimb?: string; wallMin?: number; maxGrade?: string }
  | { type: "cir";              repeats: number; climbRating?: string; avgRestSec: number }
  | { type: "pe-route";         climbSec: number; dutyCycle: string; reps: number }
  | { type: "lbc";              climbSec: number; dutyCycle: string; sets: number }
  | { type: "performance";      grade: string; tries: number; success?: string }
  | { type: "wbl";              topV: string; durationMin: number }
  | { type: "hard-bouldering";  level: string; durationMin: number }
  | { type: "limit-bouldering"; level: string; durationMin: number }
  | { type: "campus";           sets: CampusSet[] }
  | { type: "injury";           bodyPart?: string; severity?: string }
  | { type: "cardio";           mode: string; durationMin: number; intensity?: string }
  | { type: "stretching";       stretches?: string[]; reps?: number; holdSec?: number }
  | { type: "freeform";         title: string; sections: FreeformSection[] }
  | { type: "lifts";            lifts: LiftEntry[] };

export type SessionSetRecord = {
  weight: number;
  reps: number;
  completed: boolean;
  notes?: string;
};

/** The target weights that the *next* session of this hold will start from. */
export type SessionNextTarget = {
  set1: number;
  set2: number | null;
  set3?: number | null;
};

export type SessionHoldRecord = {
  holdId: string;
  holdName: string;
  set1: SessionSetRecord;
  set2: SessionSetRecord | null; // null when hold.numSets === 1
  set3?: SessionSetRecord | null; // max-hang 3rd set
  next?: SessionNextTarget; // weights queued for next session (captured at save time)
  notes?: string;
};

export type SessionRecord = {
  id: string;
  workoutType: "repeaters" | "max-hang" | "beginner" | GymWorkoutType;
  startedAt: number;
  completedAt: number;
  bailed: boolean;
  holds: SessionHoldRecord[];
  notes?: string;
  imported?: boolean;
  gymData?: GymData;
};

// ─── CRUD ────────────────────────────────────────────────────────────────────

const sessions = recordStore<SessionRecord>("sessions");

/** Insert or replace a session. */
export const saveSession = sessions.put;
export const deleteSession = sessions.remove;

// Migrate legacy workout type values stored before the rename.
function normalizeSession(s: SessionRecord): SessionRecord {
  // The stored value predates the rename, so it's wider than the current type.
  const stored = s.workoutType as string;
  return {
    ...s,
    workoutType:
      stored === "a" ? "repeaters" :
      stored === "b" ? "max-hang" :
      s.workoutType,
  };
}

/** Returns all sessions sorted newest-first. */
export async function getSessions(): Promise<SessionRecord[]> {
  return (await sessions.allBy("by-start")).map(normalizeSession).reverse();
}

/** One session by id. Undefined once it has been deleted, which a stale
 *  deep link into the editor will hit. */
export async function getSession(id: string): Promise<SessionRecord | undefined> {
  const record = await sessions.get(id);
  return record && normalizeSession(record);
}

// ─── Session record builder (pure — unit-testable) ───────────────────────────

type BuildArgs = {
  workoutType: "repeaters" | "max-hang" | "beginner";
  startedAt: number;
  completedAt: number;
  bailed: boolean;
  /** `setKey(holdIndex, setNumber)` for every set actually finished (from the state machine). */
  completedSets: readonly string[];
  holds: readonly HoldDefinition[];
  effectiveWeight: (holdId: string, setNum: number) => number;
  /** Persisted target weight for next session; when provided, captured per hold as `next`. */
  nextWeight?: (holdId: string, setNum: number) => number;
  notes?: string;
  holdNotes?: Record<string, string>;
  setNotes?: Record<string, { set1?: string; set2?: string; set3?: string }>;
  failedSets?: Record<string, { set1?: boolean; set2?: boolean; set3?: boolean }>;
};

export function buildSessionRecord({
  workoutType,
  startedAt,
  completedAt,
  bailed,
  completedSets,
  holds,
  effectiveWeight,
  nextWeight,
  notes,
  holdNotes,
  setNotes,
  failedSets,
}: BuildArgs): SessionRecord {
  const holdRecords: SessionHoldRecord[] = holds.map((hold, i) => {
    const numSets = numSetsOf(hold);
    // Skipped and unreached sets were never done; a set marked failed wasn't either.
    const done = (n: 1 | 2 | 3) =>
      completedSets.includes(setKey(i, n)) && !failedSets?.[hold.id]?.[`set${n}`];

    const set1: SessionSetRecord = {
      weight: effectiveWeight(hold.id, 1),
      reps: repsFor(hold, 1),
      completed: done(1),
      ...(setNotes?.[hold.id]?.set1 ? { notes: setNotes[hold.id].set1 } : {}),
    };

    const set2: SessionSetRecord | null =
      numSets >= 2
        ? {
            weight: effectiveWeight(hold.id, 2),
            reps: repsFor(hold, 2),
            completed: done(2),
            ...(setNotes?.[hold.id]?.set2 ? { notes: setNotes[hold.id].set2 } : {}),
          }
        : null;

    const set3: SessionSetRecord | null =
      numSets >= 3
        ? {
            weight: effectiveWeight(hold.id, 3),
            reps: repsFor(hold, 3),
            completed: done(3),
            ...(setNotes?.[hold.id]?.set3 ? { notes: setNotes[hold.id].set3 } : {}),
          }
        : null;

    const next: SessionNextTarget | undefined =
      nextWeight && !hold.isRestOnly && !hold.skipProgression
        ? {
            set1: nextWeight(hold.id, 1),
            set2: numSets >= 2 ? nextWeight(hold.id, 2) : null,
            ...(numSets >= 3 ? { set3: nextWeight(hold.id, 3) } : {}),
          }
        : undefined;

    return {
      holdId: hold.id,
      holdName: hold.name,
      set1,
      set2,
      ...(set3 !== null ? { set3 } : {}),
      ...(next !== undefined ? { next } : {}),
      ...(holdNotes?.[hold.id] ? { notes: holdNotes[hold.id] } : {}),
    };
  });

  return {
    id: crypto.randomUUID(),
    workoutType,
    startedAt,
    completedAt,
    bailed,
    holds: holdRecords,
    ...(notes ? { notes } : {}),
  };
}
