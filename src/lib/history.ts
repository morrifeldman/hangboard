import { openDB, type IDBPDatabase } from "idb";
import type { HoldDefinition } from "../data/holds";

// ─── Types ───────────────────────────────────────────────────────────────────

export type SessionSetRecord = {
  weight: number;
  reps: number;
  completed: boolean;
};

export type SessionHoldRecord = {
  holdId: string;
  holdName: string;
  set1: SessionSetRecord;
  set2: SessionSetRecord | null; // null when hold.numSets === 1
  notes?: string;
};

export type SessionRecord = {
  id: string;
  workoutType: "a" | "b";
  startedAt: number;
  completedAt: number;
  bailed: boolean;
  holds: SessionHoldRecord[];
  notes?: string;
  imported?: boolean;
};

// ─── IndexedDB setup ─────────────────────────────────────────────────────────

const DB_NAME = "hangboard-history";
const DB_VERSION = 1;
const STORE = "sessions";

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("by-start", "startedAt");
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
  return all.reverse();
}

export async function deleteSession(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE, id);
}

export async function updateSession(record: SessionRecord): Promise<void> {
  const db = await getDB();
  await db.put(STORE, record);
}

// ─── Session record builder (pure — unit-testable) ───────────────────────────

type BuildArgs = {
  workoutType: "a" | "b";
  startedAt: number;
  completedAt: number;
  bailed: boolean;
  holdIndex: number;
  setNumber: number;
  holds: readonly HoldDefinition[];
  effectiveWeight: (holdId: string, setNum: 1 | 2) => number;
  notes?: string;
  holdNotes?: Record<string, string>;
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
}: BuildArgs): SessionRecord {
  const holdRecords: SessionHoldRecord[] = holds.map((hold, i) => {
    const numSets = hold.numSets ?? 2;
    const reps1 = hold.repsPerSet ?? hold.set1Reps;
    const reps2 = hold.repsPerSet ?? hold.set2Reps;

    let set1Completed: boolean;
    let set2Completed: boolean;

    if (!bailed) {
      // Workout fully completed — all sets done
      set1Completed = true;
      set2Completed = true;
    } else if (i < holdIndex) {
      // Holds entirely before the bail point
      set1Completed = true;
      set2Completed = true;
    } else if (i === holdIndex) {
      // The hold being worked when bailed
      set1Completed = setNumber >= 2; // started set 2 → set 1 is done
      set2Completed = false; // bail means set 2 never finished
    } else {
      // Holds after the bail point — never started
      set1Completed = false;
      set2Completed = false;
    }

    const set1: SessionSetRecord = {
      weight: effectiveWeight(hold.id, 1),
      reps: reps1,
      completed: set1Completed,
    };

    const set2: SessionSetRecord | null =
      numSets >= 2
        ? {
            weight: effectiveWeight(hold.id, 2),
            reps: reps2,
            completed: set2Completed,
          }
        : null;

    return {
      holdId: hold.id,
      holdName: hold.name,
      set1,
      set2,
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
