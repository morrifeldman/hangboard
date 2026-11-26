import type { ClimbStyle, ClimbType, ClimbSetting, RouteDiscipline } from "../constants/climbGrades";
import { recordStore, replaceStores } from "./db";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ClimbRecord = {
  id: string;
  route: string;
  grade: string;
  location: string;
  type: ClimbType;
  setting: ClimbSetting;
  /** Routes only. Absent means sport (records imported before trad was kept). */
  discipline?: RouteDiscipline;
  style: ClimbStyle;
  climbs: number;
  date: string; // YYYY-MM-DD
  notes: string;
  /** Mountain Project route page, from the tick export's URL column. */
  url?: string;
  /** Your Mountain Project star rating for the route (0–4), from "Your Stars". */
  stars?: number;
  /** Mountain Project's average star rating (0–4) as of the export, from "Avg Stars". */
  avgStars?: number;
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

/** A usable star rating: a number from 0 to 4. Anything else (a bad backup) is none. */
export function validStars(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 4 ? v : undefined;
}

/**
 * A route's star ratings: the first of its ticks (newest first) that has each.
 * Mountain Project repeats the route's ratings on every tick, so any will do.
 */
export function routeStars(sessions: ClimbRecord[]): { stars?: number; avgStars?: number } {
  const pick = (key: "stars" | "avgStars") => {
    for (const c of sessions) {
      const v = validStars(c[key]);
      if (v !== undefined) return v;
    }
    return undefined;
  };
  return { stars: pick("stars"), avgStars: pick("avgStars") };
}
