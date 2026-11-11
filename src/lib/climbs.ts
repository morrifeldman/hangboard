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
  /** Mountain Project route page, from the tick export's URL column. */
  url?: string;
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

/** The Mountain Project page for a route: the first of its ticks that has one. */
export function routeUrl(sessions: ClimbRecord[]): string | undefined {
  return sessions.find((c) => c.url)?.url;
}
