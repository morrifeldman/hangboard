import type { SessionRecord } from "./history";

// ─── Types ───────────────────────────────────────────────────────────────────

export type TrendPoint = {
  weight: number;
  date: Date;
  bailed: boolean;
  isPR: boolean;
};

export type CalendarDay = {
  date: Date;
  workoutType: "a" | "b" | "both" | null;
};

// ─── buildTrend ───────────────────────────────────────────────────────────────

/**
 * Returns up to 20 trend points (oldest→newest) for a given hold in a given
 * workout type.  Only sessions that contain the hold and match the workout type
 * are included.  Sessions whose bailed flag is set are still included so the
 * user can see where they fell short; isPR marks the highest-weight point.
 *
 * sessions is newest-first (as returned by getSessions()).
 */
export function buildTrend(
  sessions: SessionRecord[],
  holdId: string,
  workoutType: "a" | "b"
): TrendPoint[] {
  const filtered = sessions
    .filter((s) => s.workoutType === workoutType)
    .filter((s) => s.holds.some((h) => h.holdId === holdId));

  // Take newest 20, then reverse to oldest→newest
  const sliced = filtered.slice(0, 20).reverse();

  if (sliced.length === 0) return [];

  // Find max weight to mark PR
  let maxWeight = -Infinity;
  for (const s of sliced) {
    const hr = s.holds.find((h) => h.holdId === holdId);
    if (hr) maxWeight = Math.max(maxWeight, hr.set1.weight);
  }

  return sliced.map((s) => {
    const hr = s.holds.find((h) => h.holdId === holdId)!;
    const weight = hr.set1.weight;
    return {
      weight,
      date: new Date(s.startedAt),
      bailed: s.bailed,
      isPR: weight === maxWeight,
    };
  });
}

// ─── buildCalendar ────────────────────────────────────────────────────────────

/**
 * Returns a 12×7 grid of CalendarDay objects covering 12 ISO weeks ending with
 * the current week.  Outer index = week (0 = oldest), inner index = day (0 =
 * Monday, 6 = Sunday).
 */
export function buildCalendar(sessions: SessionRecord[]): CalendarDay[][] {
  // Build a lookup keyed by ISO date string "YYYY-MM-DD"
  const dayMap = new Map<string, Set<"a" | "b">>();
  for (const s of sessions) {
    const d = new Date(s.startedAt);
    const key = isoDate(d);
    if (!dayMap.has(key)) dayMap.set(key, new Set());
    dayMap.get(key)!.add(s.workoutType);
  }

  // Find the Monday of the current ISO week
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun … 6=Sat
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const thisMonday = new Date(today);
  thisMonday.setHours(0, 0, 0, 0);
  thisMonday.setDate(today.getDate() + diffToMonday);

  // Start 11 weeks before this Monday
  const startMonday = new Date(thisMonday);
  startMonday.setDate(thisMonday.getDate() - 11 * 7);

  const weeks: CalendarDay[][] = [];

  for (let w = 0; w < 12; w++) {
    const week: CalendarDay[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(startMonday);
      date.setDate(startMonday.getDate() + w * 7 + d);
      const key = isoDate(date);
      const types = dayMap.get(key);
      let workoutType: "a" | "b" | "both" | null = null;
      if (types) {
        const hasA = types.has("a");
        const hasB = types.has("b");
        workoutType = hasA && hasB ? "both" : hasA ? "a" : "b";
      }
      week.push({ date: new Date(date), workoutType });
    }
    weeks.push(week);
  }

  return weeks;
}

// ─── calendarMonthLabels ──────────────────────────────────────────────────────

/**
 * Returns 12 strings — one per week column.  A string is the abbreviated month
 * name when that week is the first week of a new month in the grid; otherwise
 * it is "".
 */
export function calendarMonthLabels(weeks: CalendarDay[][]): string[] {
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const labels: string[] = [];
  let lastMonth = -1;

  for (const week of weeks) {
    // Use Monday (day 0) of the week for the label
    const month = week[0].date.getMonth();
    if (month !== lastMonth) {
      labels.push(MONTHS[month]);
      lastMonth = month;
    } else {
      labels.push("");
    }
  }

  return labels;
}

// ─── computeStats ─────────────────────────────────────────────────────────────

export function computeStats(sessions: SessionRecord[]): {
  totalCompleted: number;
} {
  return { totalCompleted: sessions.filter((s) => !s.bailed).length };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

