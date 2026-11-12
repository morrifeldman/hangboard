import type { SessionRecord } from "./history";
import { sessionPRs } from "./personalRecords";
import type { ClimbRecord } from "./climbs";
import {
  ACTIVITY_CATEGORIES,
  climbCategory,
  isActivitySession,
  sessionCategory,
  type ActivityCategory,
} from "./sessionKind";
import { addDays, startOfWeek, toLocalDateString } from "./dates";

// ─── Types ───────────────────────────────────────────────────────────────────

export type TrendPoint = {
  weight: number;
  date: Date;
  bailed: boolean;
  isPR: boolean;
  setFailed: boolean; // any non-set1 set existed but was not completed
  sessionId: string;
};

export type CalendarDay = {
  date: Date;
  /**
   * Every activity category logged that day, in display order (see
   * sessionKind.ts). The calendar draws one slice per category.
   */
  categories: ActivityCategory[];
  isToday: boolean;
};

// ─── buildTrend ───────────────────────────────────────────────────────────────

/**
 * Returns up to 20 trend points (oldest→newest) for a given hold in a given
 * workout type.  Only sessions that contain the hold and match the workout type
 * are included.  Sessions whose bailed flag is set are still included so the
 * user can see where they fell short.
 *
 * isPR follows personalRecords' rules (completed weights only, warm-ups
 * excluded, first time on a hold is a baseline). sessions may be in any order.
 */
export function buildTrend(
  sessions: SessionRecord[],
  holdId: string,
  workoutType: "repeaters" | "max-hang"
): TrendPoint[] {
  // Newest first regardless of how the caller ordered them.
  const filtered = sessions
    .filter((s) => s.workoutType === workoutType)
    .filter((s) => s.holds.some((h) => h.holdId === holdId && h.set1.completed))
    .sort((a, b) => b.startedAt - a.startedAt);

  // Take newest 20, then reverse to oldest→newest
  const sliced = filtered.slice(0, 20).reverse();

  if (sliced.length === 0) return [];

  // PR flags come from personalRecords, computed over the full history, so the
  // chart and History always agree.
  const prs = sessionPRs(sessions);

  return sliced.map((s) => {
    const hr = s.holds.find((h) => h.holdId === holdId)!;
    const weight = Math.max(
      hr.set1.weight,
      hr.set2?.weight ?? -Infinity,
      hr.set3?.weight ?? -Infinity,
    );
    const setFailed =
      (hr.set2 != null && !hr.set2.completed) ||
      (hr.set3 != null && !hr.set3.completed);
    return {
      weight,
      date: new Date(s.startedAt),
      bailed: s.bailed,
      isPR: prs.get(s.id)?.includes(holdId) ?? false,
      setFailed,
      sessionId: s.id,
    };
  });
}

// ─── buildCalendar ────────────────────────────────────────────────────────────

/**
 * Returns a 12×7 grid of CalendarDay objects covering 12 ISO weeks ending with
 * the current week.  Outer index = week (0 = oldest), inner index = day (0 =
 * Monday, 6 = Sunday).
 *
 * Sessions and logged routes are both classified by sessionKind.ts, so an
 * indoor route log reads as indoor climbing and an injury entry colours nothing.
 */
export function buildCalendar(
  sessions: SessionRecord[],
  climbs: ReadonlyArray<Pick<ClimbRecord, "date" | "setting">> = [],
): CalendarDay[][] {
  // Local date key "YYYY-MM-DD" → categories logged that day.
  const dayMap = new Map<string, Set<ActivityCategory>>();
  const mark = (key: string, category: ActivityCategory) => {
    if (!dayMap.has(key)) dayMap.set(key, new Set());
    dayMap.get(key)!.add(category);
  };
  for (const s of sessions) {
    if (isActivitySession(s)) mark(toLocalDateString(new Date(s.startedAt)), sessionCategory(s));
  }
  for (const c of climbs) mark(c.date, climbCategory(c));

  // Find the Monday of the current ISO week
  const today = new Date();
  const todayKey = toLocalDateString(today);
  // Start 11 weeks before this week's Monday
  const startMonday = addDays(startOfWeek(today), -11 * 7);

  const weeks: CalendarDay[][] = [];

  for (let w = 0; w < 12; w++) {
    const week: CalendarDay[] = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(startMonday, w * 7 + d);
      const key = toLocalDateString(date);
      const logged = dayMap.get(key);
      week.push({
        date: new Date(date),
        categories: logged
          ? ACTIVITY_CATEGORIES.map((c) => c.id).filter((id) => logged.has(id))
          : [],
        isToday: key === todayKey,
      });
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
