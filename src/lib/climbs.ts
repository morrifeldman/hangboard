import type { ClimbStyle, ClimbType, ClimbSetting } from "../constants/climbGrades";
import { getDB } from "./history";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ClimbRecord = {
  id: string;
  route: string;
  grade: string;
  location: string;
  type: ClimbType;
  setting: ClimbSetting;
  style: ClimbStyle;
  climbs: number;
  date: string; // YYYY-MM-DD
  notes: string;
};

// ─── CRUD ────────────────────────────────────────────────────────────────────

const STORE = "climbs";

export async function addClimb(record: ClimbRecord): Promise<void> {
  const db = await getDB();
  await db.put(STORE, record);
}

export async function getClimbs(): Promise<ClimbRecord[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex(STORE, "by-date");
  return (all as ClimbRecord[]).reverse(); // newest first
}

export async function updateClimb(record: ClimbRecord): Promise<void> {
  const db = await getDB();
  await db.put(STORE, record);
}

export async function deleteClimb(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE, id);
}

export async function replaceAllClimbs(records: ClimbRecord[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORE, "readwrite");
  await tx.store.clear();
  for (const r of records) {
    await tx.store.put(r);
  }
  await tx.done;
}
