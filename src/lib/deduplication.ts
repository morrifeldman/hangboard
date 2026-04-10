import type { ClimbRecord } from "./climbs";
import { STYLE_PRIORITY } from "../constants/climbGrades";

/** Same-day deduplication for timeline view. Merges entries for the same route on the same date. */
export function deduplicateForTimeline(climbs: ClimbRecord[]): ClimbRecord[] {
  const byDate: Record<string, Record<string, ClimbRecord>> = {};

  for (const climb of climbs) {
    const dateKey = climb.date;
    if (!byDate[dateKey]) byDate[dateKey] = {};
    const climbKey = `${climb.route}-${climb.location}-${climb.grade}`;

    const existing = byDate[dateKey][climbKey];
    if (existing) {
      existing.attempts += climb.attempts;
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

/** Aggressive cross-date deduplication for pyramid view. Merges all entries for the same route. */
export function deduplicateForPyramid(climbs: ClimbRecord[]): ClimbRecord[] {
  const byRoute: Record<string, ClimbRecord> = {};

  for (const climb of climbs) {
    const routeKey = `${climb.route}-${climb.location}`;
    const existing = byRoute[routeKey];

    if (existing) {
      existing.attempts += climb.attempts;
      if (climb.notes && climb.notes !== existing.notes) {
        existing.notes = existing.notes ? `${existing.notes}; ${climb.notes}` : climb.notes;
      }
      if (STYLE_PRIORITY[climb.style] < STYLE_PRIORITY[existing.style]) {
        existing.style = climb.style;
      }
      if (new Date(climb.date) >= new Date(existing.date)) {
        existing.date = climb.date;
        existing.grade = climb.grade;
        existing.type = climb.type;
        existing.setting = climb.setting;
      }
    } else {
      byRoute[routeKey] = { ...climb };
    }
  }

  return Object.values(byRoute).map((climb) => {
    if (climb.style === "redpoint" && climb.attempts < 2) {
      return { ...climb, attempts: 2 };
    }
    return climb;
  });
}
