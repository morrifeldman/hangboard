import type { ClimbStyle, ClimbType, ClimbSetting } from "../constants/climbGrades";
import { recordStore, replaceStores } from "./db";

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

const climbs = recordStore<ClimbRecord>("climbs");

/** Insert or replace a climb. */
export const saveClimb = climbs.put;
export const deleteClimb = climbs.remove;

export async function getClimbs(): Promise<ClimbRecord[]> {
  return (await climbs.allBy("by-date")).reverse(); // newest first
}

export async function replaceAllClimbs(records: ClimbRecord[]): Promise<void> {
  await replaceStores({ climbs: records });
}
