import { openDB, type IDBPDatabase } from "idb";
import type { HoldDefinition } from "../data/holds";

// ─── Types ───────────────────────────────────────────────────────────────────

export type GymWorkoutType =
  | "arc" | "cir" | "pe-route" | "lbc" | "wbl"
  | "performance" | "hard-bouldering" | "limit-bouldering" | "injury"
  | "stretching";

export type GymData =
  | { type: "arc";              climbMin: number; routes?: number; downclimb?: string; wallMin?: number; maxGrade?: string }
  | { type: "cir";              repeats: number; climbRating?: string; avgRestSec: number }
  | { type: "pe-route";         climbSec: number; dutyCycle: string; reps: number }
  | { type: "lbc";              climbSec: number; dutyCycle: string; sets: number }
  | { type: "performance";      grade: string; tries: number; success?: string }
  | { type: "wbl";              topV: string; durationMin: number }
  | { type: "hard-bouldering";  level: string; durationMin: number }
  | { type: "limit-bouldering"; level: string; durationMin: number }
  | { type: "injury";           bodyPart?: string; severity?: string }
  | { type: "stretching";       stretches?: string[]; reps?: number; holdSec?: number };

export type SessionSetRecord = {
  weight: number;
  reps: number;
  completed: boolean;
  notes?: string;
};

export type SessionHoldRecord = {
  holdId: string;
  holdName: string;
  set1: SessionSetRecord;
  set2: SessionSetRecord | null; // null when hold.numSets === 1
  set3?: SessionSetRecord | null; // max-hang 3rd set
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

// ─── IndexedDB setup ─────────────────────────────────────────────────────────

const DB_NAME = "hangboard-history";
const DB_VERSION = 3;
const STORE = "sessions";

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: "id" });
          store.createIndex("by-start", "startedAt");
        }
        if (!db.objectStoreNames.contains("climbs")) {
          const climbStore = db.createObjectStore("climbs", { keyPath: "id" });
          climbStore.createIndex("by-date", "date");
        }
        if (!db.objectStoreNames.contains("notes")) {
          const noteStore = db.createObjectStore("notes", { keyPath: "id" });
          noteStore.createIndex("by-date", "date");
        }
      },
    });
  }
  return dbPromise;
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function addSession(record: SessionRecord): Promise<void> {
  const db = await getDB();
  await db.put(STORE, record);
}

/** Returns all sessions sorted newest-first. */
export async function getSessions(): Promise<SessionRecord[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex(STORE, "by-start");
  // Migrate legacy workout type values stored before the rename
  const normalized = all.map((s) => ({
    ...s,
    workoutType:
      s.workoutType === "a" ? "repeaters" :
      s.workoutType === "b" ? "max-hang" :
      s.workoutType,
  }));
  return normalized.reverse();
}

export async function deleteSession(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE, id);
}

export async function updateSession(record: SessionRecord): Promise<void> {
  const db = await getDB();
  await db.put(STORE, record);
}

export async function replaceAllSessions(records: SessionRecord[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORE, "readwrite");
  await tx.store.clear();
  for (const r of records) {
    await tx.store.put(r);
  }
  await tx.done;
}

// ─── Session record builder (pure — unit-testable) ───────────────────────────

type BuildArgs = {
  workoutType: "repeaters" | "max-hang" | "beginner";
  startedAt: number;
  completedAt: number;
  bailed: boolean;
  holdIndex: number;
  setNumber: number;
  holds: readonly HoldDefinition[];
  effectiveWeight: (holdId: string, setNum: number) => number;
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
  holdIndex,
  setNumber,
  holds,
  effectiveWeight,
  notes,
  holdNotes,
  setNotes,
  failedSets,
}: BuildArgs): SessionRecord {
  const holdRecords: SessionHoldRecord[] = holds.map((hold, i) => {
    const numSets = hold.numSets ?? 2;
    const reps1 = hold.repsPerSet ?? hold.set1Reps;
    const reps2 = hold.repsPerSet ?? hold.set2Reps;

    let set1Completed: boolean;
    let set2Completed: boolean;
    let set3Completed: boolean;

    if (!bailed) {
      set1Completed = true;
      set2Completed = true;
      set3Completed = true;
    } else if (i < holdIndex) {
      set1Completed = true;
      set2Completed = true;
      set3Completed = true;
    } else if (i === holdIndex) {
      set1Completed = setNumber >= 2;
      set2Completed = setNumber >= 3;
      set3Completed = false;
    } else {
      set1Completed = false;
      set2Completed = false;
      set3Completed = false;
    }

    if (failedSets?.[hold.id]?.set1) set1Completed = false;
    if (failedSets?.[hold.id]?.set2) set2Completed = false;
    if (failedSets?.[hold.id]?.set3) set3Completed = false;

    const set1: SessionSetRecord = {
      weight: effectiveWeight(hold.id, 1),
      reps: reps1,
      completed: set1Completed,
      ...(setNotes?.[hold.id]?.set1 ? { notes: setNotes[hold.id].set1 } : {}),
    };

    const set2: SessionSetRecord | null =
      numSets >= 2
        ? {
            weight: effectiveWeight(hold.id, 2),
            reps: reps2,
            completed: set2Completed,
            ...(setNotes?.[hold.id]?.set2 ? { notes: setNotes[hold.id].set2 } : {}),
          }
        : null;

    const set3: SessionSetRecord | null =
      numSets >= 3
        ? {
            weight: effectiveWeight(hold.id, 3),
            reps: reps2,
            completed: set3Completed,
            ...(setNotes?.[hold.id]?.set3 ? { notes: setNotes[hold.id].set3 } : {}),
          }
        : null;

    return {
      holdId: hold.id,
      holdName: hold.name,
      set1,
      set2,
      ...(set3 !== null ? { set3 } : {}),
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
