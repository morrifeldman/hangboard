import type { SessionRecord } from "./history";

// ─── Types ───────────────────────────────────────────────────────────────────

export type TrendPoint = {
  weight: number;
  date: Date;
  bailed: boolean;
  isPR: boolean;
  setFailed: boolean; // any non-set1 set existed but was not completed
  isBeginner: boolean;
  sessionId: string;
};

export type WorkoutBucket = "gym" | "cardio" | "stretching";

export type CalendarDay = {
  date: Date;
  /**
   * Highest-priority bucket present that day (gym > cardio > stretching), or
   * null if none. Handy as a summary, but the calendar renders every flagged
   * bucket as its own slice rather than picking one.
   * - "gym": any board (repeaters/max-hang/beginner) or gym session that isn't
   *   cardio or stretching — hangboarding counts as gym.
   * - "cardio" / "stretching": their own buckets so recovery work stands apart.
   */
  workoutType: WorkoutBucket | null;
  gym: boolean;
  cardio: boolean;
  stretching: boolean;
  outdoor: boolean;
  isToday: boolean;
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
  workoutType: "repeaters" | "max-hang"
): TrendPoint[] {
  const filtered = sessions
    .filter((s) => s.workoutType === workoutType || (workoutType === "repeaters" && s.workoutType === "beginner"))
    .filter((s) => s.holds.some((h) => h.holdId === holdId && h.set1.completed));

  // Take newest 20, then reverse to oldest→newest
  const sliced = filtered.slice(0, 20).reverse();

  if (sliced.length === 0) return [];

  // Find max weight to mark PR — only count sessions where all sets completed
  let maxWeight = -Infinity;
  for (const s of sliced) {
    const hr = s.holds.find((h) => h.holdId === holdId);
    if (hr
      && (hr.set2 === null || hr.set2 === undefined || hr.set2.completed)
      && (hr.set3 === null || hr.set3 === undefined || hr.set3.completed)
    ) {
      const w = Math.max(
        hr.set1.weight,
        hr.set2?.weight ?? -Infinity,
        hr.set3?.weight ?? -Infinity,
      );
      maxWeight = Math.max(maxWeight, w);
    }
  }

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
      isPR: !setFailed && weight === maxWeight,
      setFailed,
      isBeginner: s.workoutType === "beginner",
      sessionId: s.id,
    };
  });
}

// ─── buildCalendar ────────────────────────────────────────────────────────────

/**
 * Collapse a session into one of the three calendar buckets. Board work and
 * most gym workouts read as "gym"; cardio and stretching get their own bucket.
 */
function sessionCategory(s: SessionRecord): WorkoutBucket {
  if (s.gymData?.type === "cardio") return "cardio";
  if (s.gymData?.type === "stretching") return "stretching";
  return "gym";
}

/**
 * Returns a 12×7 grid of CalendarDay objects covering 12 ISO weeks ending with
 * the current week.  Outer index = week (0 = oldest), inner index = day (0 =
 * Monday, 6 = Sunday).
 */
export function buildCalendar(
  sessions: SessionRecord[],
  climbDates?: Set<string>,
): CalendarDay[][] {
  // Build a lookup keyed by ISO date string "YYYY-MM-DD" → set of buckets.
  const dayMap = new Map<string, Set<WorkoutBucket>>();
  for (const s of sessions) {
    const d = new Date(s.startedAt);
    const key = isoDate(d);
    if (!dayMap.has(key)) dayMap.set(key, new Set());
    dayMap.get(key)!.add(sessionCategory(s));
  }

  // Find the Monday of the current ISO week
  const today = new Date();
  const todayKey = isoDate(today);
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
      const gym = types?.has("gym") ?? false;
      const cardio = types?.has("cardio") ?? false;
      const stretching = types?.has("stretching") ?? false;
      // Priority for the fill color: gym (the main effort) over recovery work.
      const workoutType: CalendarDay["workoutType"] = gym
        ? "gym"
        : cardio
          ? "cardio"
          : stretching
            ? "stretching"
            : null;
      week.push({
        date: new Date(date),
        workoutType,
        gym,
        cardio,
        stretching,
        outdoor: climbDates?.has(key) ?? false,
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

