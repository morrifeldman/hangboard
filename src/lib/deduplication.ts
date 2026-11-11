import type { ClimbRecord } from "./climbs";
import { STYLE_PRIORITY } from "../constants/climbGrades";

/** Pyramid climb after dedup — `sessions` is the number of source ClimbRecord entries merged. */
export type PyramidClimb = ClimbRecord & { sessions: number };

/** Same-day deduplication for timeline view. Merges entries for the same route on the same date. */
export function deduplicateForTimeline(climbs: ClimbRecord[]): ClimbRecord[] {
  const byDate: Record<string, Record<string, ClimbRecord>> = {};

  for (const climb of climbs) {
    const dateKey = climb.date;
    if (!byDate[dateKey]) byDate[dateKey] = {};
    const climbKey = JSON.stringify([climb.route, climb.location, climb.grade, climb.type, climb.setting]);

    const existing = byDate[dateKey][climbKey];
    if (existing) {
      existing.climbs += climb.climbs;
      if (climb.notes && climb.notes !== existing.notes) {
        existing.notes = existing.notes ? `${existing.notes}; ${climb.notes}` : climb.notes;
      }
      if (STYLE_PRIORITY[climb.style] < STYLE_PRIORITY[existing.style]) {
        existing.style = climb.style;
      }
    } else {
      byDate[dateKey][climbKey] = { ...climb };
    }
  }

  const result: ClimbRecord[] = [];
  for (const dateKey of Object.keys(byDate)) {
    for (const climb of Object.values(byDate[dateKey])) {
      result.push(climb);
    }
  }
  return result;
}

/**
 * Aggressive cross-date deduplication for pyramid view. Merges all entries for the same route.
 *
 * The merged tile is dated by its send: the first session at the route's best
 * style. Attempts before a redpoint take the redpoint's date, and later repeats
 * don't move it. A route never sent is dated by its first attempt. The grade
 * still follows the most recent session, so a regrade applies. `id` is the
 * dated session's, so the record behind the tile matches the date it shows.
 */
export function deduplicateForPyramid(climbs: ClimbRecord[]): PyramidClimb[] {
  const byRoute: Record<string, PyramidClimb> = {};
  const sessionsByRoute: Record<string, ClimbRecord[]> = {};

  for (const climb of climbs) {
    const routeKey = JSON.stringify([climb.route, climb.location, climb.type, climb.setting]);
    (sessionsByRoute[routeKey] ??= []).push(climb);
    const existing = byRoute[routeKey];

    if (existing) {
      const isSend = (s: string) => s !== "attempt";
      const existingIsSend = isSend(existing.style);
      const newIsSend = isSend(climb.style);

      if (existingIsSend && newIsSend) {
        // Re-send — skip, keep the best ascent as-is
      } else {
        existing.climbs += climb.climbs;
      }
      existing.sessions += 1;

      if (climb.notes && climb.notes !== existing.notes) {
        existing.notes = existing.notes ? `${existing.notes}; ${climb.notes}` : climb.notes;
      }
      if (STYLE_PRIORITY[climb.style] < STYLE_PRIORITY[existing.style]) {
        existing.style = climb.style;
      }
    } else {
      byRoute[routeKey] = { ...climb, sessions: 1 };
    }
  }

  for (const [routeKey, merged] of Object.entries(byRoute)) {
    const sessions = sessionsByRoute[routeKey];
    let latest = sessions[0];
    let sent: ClimbRecord | null = null;
    for (const c of sessions) {
      if (c.date > latest.date) latest = c;
      if (c.style === merged.style && (!sent || c.date < sent.date)) sent = c;
    }
    merged.grade = latest.grade;
    if (sent) {
      merged.date = sent.date;
      merged.id = sent.id;
    }
  }

  return Object.values(byRoute);
}
