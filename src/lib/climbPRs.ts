import { SPORT_GRADES, BOULDER_GRADES, type ClimbStyle } from "../constants/climbGrades";
import type { ClimbRecord } from "./climbs";

const SEND_STYLES: readonly ClimbStyle[] = ["onsight", "flash", "redpoint"];

/**
 * Ids of the sends that set a new personal best for their style: a harder grade
 * than every earlier onsight (or flash, or redpoint) of the same type. Styles
 * are tracked separately, so a 5.12a flash doesn't stop a 5.11d redpoint from
 * being a redpoint PR. The first send of a style has nothing to beat and isn't
 * one. On a day with several, only the hardest counts.
 *
 * Pass every climb in the view, not just the visible time range, so a send
 * stays a PR (or not) however the range is zoomed.
 */
export function climbPRs(climbs: ClimbRecord[]): Set<string> {
  const prs = new Set<string>();
  // Best grade index so far, per type and style.
  const best = new Map<string, number>();
  const byDate = new Map<string, ClimbRecord[]>();
  for (const c of climbs) {
    if (!SEND_STYLES.includes(c.style)) continue;
    const day = byDate.get(c.date);
    if (day) day.push(c);
    else byDate.set(c.date, [c]);
  }

  for (const date of [...byDate.keys()].sort()) {
    const dayBest = new Map<string, { idx: number; ids: string[] }>();
    for (const c of byDate.get(date)!) {
      const grades: readonly string[] = c.type === "boulder" ? BOULDER_GRADES : SPORT_GRADES;
      const idx = grades.indexOf(c.grade);
      if (idx === -1) continue;
      const key = `${c.type}:${c.style}`;
      const cur = dayBest.get(key);
      if (!cur || idx > cur.idx) dayBest.set(key, { idx, ids: [c.id] });
      else if (idx === cur.idx) cur.ids.push(c.id);
    }
    for (const [key, { idx, ids }] of dayBest) {
      const prev = best.get(key);
      if (prev !== undefined && idx > prev) ids.forEach((id) => prs.add(id));
      if (prev === undefined || idx > prev) best.set(key, idx);
    }
  }
  return prs;
}
