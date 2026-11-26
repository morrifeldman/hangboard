import { SPORT_GRADES, BOULDER_GRADES } from "../constants/climbGrades";
import type { ClimbRecord } from "./climbs";
import { VIEWS } from "../constants/climbGrades";
import type { ClimbStyle, DisciplineFilter, RouteDiscipline, ViewKey } from "../constants/climbGrades";
import { dateKeyToTime } from "./dates";

// One colour per send style, used everywhere a climb's style is shown.
const STYLE_SOLID: Record<ClimbStyle, string> = {
  onsight: "bg-green-500",
  flash: "bg-yellow-500",
  redpoint: "bg-red-500",
  toprope: "bg-purple-500",
  attempt: "bg-gray-400",
};

const STYLE_BADGE: Record<ClimbStyle, string> = {
  onsight: "bg-green-500/20 text-green-400",
  flash: "bg-yellow-500/20 text-yellow-400",
  redpoint: "bg-red-500/20 text-red-400",
  toprope: "bg-purple-500/20 text-purple-300",
  attempt: "bg-gray-700 text-gray-400",
};

/**
 * What the pyramids' "sends only" view keeps: a clean ascent on lead. Top rope
 * and following are clean but not led, so they sit with attempts behind the
 * toggle, in their own colour.
 */
export function isLeadSend(c: Pick<ClimbRecord, "style">): boolean {
  return c.style !== "attempt" && c.style !== "toprope";
}

/** Solid fill for a style (pyramid tiles, timeline dots, legend). */
export function getStyleColor(style: ClimbStyle): string {
  return STYLE_SOLID[style] ?? "bg-gray-500";
}

/** Tinted text badge for a style (lists and detail sheets). */
export function styleBadgeClass(style: string): string {
  return STYLE_BADGE[style as ClimbStyle] ?? STYLE_BADGE.attempt;
}

/** Short per-session label: "onsight", "2 attempts · send", "top rope", … */
export function climbStyleLabel(c: Pick<ClimbRecord, "style" | "climbs">): string {
  if (c.style === "attempt") return c.climbs > 1 ? `${c.climbs} attempts` : "attempt";
  if (c.style === "toprope") return "top rope";
  if (c.style === "redpoint") {
    const falls = c.climbs - 1;
    return falls > 0 ? `${falls} attempt${falls !== 1 ? "s" : ""} · send` : "redpoint";
  }
  return c.style;
}

/** Row entries may carry an optional `sessions` count when sourced from `deduplicateForPyramid`. */
export type PyramidRowClimb = ClimbRecord & { sessions?: number };
export type PyramidRow = { grade: string; climbs: PyramidRowClimb[] };

export function buildPyramid(filteredClimbs: ClimbRecord[], currentView: ViewKey): PyramidRow[] {
  const isBoulderer = currentView.includes("boulder");
  const grades: readonly string[] = isBoulderer ? BOULDER_GRADES : SPORT_GRADES;

  const pyramidData: Record<string, ClimbRecord[]> = {};
  for (const g of grades) pyramidData[g] = [];
  for (const c of filteredClimbs) {
    if (pyramidData[c.grade]) pyramidData[c.grade].push(c);
  }

  const usedGrades = grades.filter((g) => pyramidData[g].length > 0);
  if (usedGrades.length === 0) return [];

  const gradeArr = grades as unknown as string[];
  const minIdx = Math.min(...usedGrades.map((g) => gradeArr.indexOf(g)));
  const maxIdx = Math.max(...usedGrades.map((g) => gradeArr.indexOf(g)));
  const gradesToShow = grades.slice(minIdx, maxIdx + 1);

  return [...gradesToShow].reverse().map((g) => ({
    grade: g,
    climbs: pyramidData[g].slice().sort((a, b) => a.date.localeCompare(b.date)),
  }));
}

function viewDef(view: ViewKey) {
  return VIEWS.find((v) => v.key === view)!;
}

/** A route's discipline; records from before it was kept are sport. */
export function climbDiscipline(c: Pick<ClimbRecord, "discipline">): RouteDiscipline {
  return c.discipline ?? "sport";
}

export function isTrad(c: Pick<ClimbRecord, "discipline">): boolean {
  return c.discipline === "trad";
}

/**
 * Climbs matching a pyramid view (setting + type), narrowed to one discipline:
 * sport, trad or top-rope-only. "all" keeps every route.
 */
export function climbsInView(
  climbs: ClimbRecord[],
  view: ViewKey,
  discipline: DisciplineFilter = "all",
): ClimbRecord[] {
  const { setting, type } = viewDef(view);
  return climbs.filter((c) => {
    if (c.setting !== setting || c.type !== type) return false;
    if (type === "boulder" || discipline === "all") return true;
    return climbDiscipline(c) === discipline;
  });
}

/**
 * The slider's [startPct, endPct] mapped onto the span of dates in `climbs`.
 * The filter and the slider's date labels both use this, so they always agree.
 */
function timeWindow(climbs: ClimbRecord[], timeRange: [number, number]) {
  if (climbs.length === 0) return null;
  const times = climbs.map((c) => dateKeyToTime(c.date));
  const min = Math.min(...times);
  const max = Math.max(...times);
  const span = max - min;
  return {
    min,
    max,
    start: min + (span * timeRange[0]) / 100,
    end: min + (span * timeRange[1]) / 100,
  };
}

/** Climbs in `view` whose date falls inside the slider window. */
export function getFilteredClimbs(
  climbs: ClimbRecord[],
  view: ViewKey,
  timeRange: [number, number],
  discipline: DisciplineFilter = "all",
): ClimbRecord[] {
  const inView = climbsInView(climbs, view, discipline);
  const w = timeWindow(inView, timeRange);
  if (!w) return inView;
  return inView.filter((c) => {
    const t = dateKeyToTime(c.date);
    return t >= w.start && t <= w.end;
  });
}

export type DateRangeInfo = {
  startDate: Date;
  endDate: Date;
  isFullRange: boolean;
};

export function getDateRangeInfo(
  climbs: ClimbRecord[],
  view: ViewKey,
  timeRange: [number, number],
  discipline: DisciplineFilter = "all",
): DateRangeInfo | null {
  const w = timeWindow(climbsInView(climbs, view, discipline), timeRange);
  if (!w) return null;
  return {
    startDate: new Date(w.start),
    endDate: new Date(w.end),
    isFullRange: w.min === w.max || (timeRange[0] === 0 && timeRange[1] === 100),
  };
}

/** A real ascent: led clean. Onsight and flash are redpoints that took one try. */
const REAL_ASCENT: ReadonlySet<ClimbStyle> = new Set(["onsight", "flash", "redpoint"]);

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * What a route took: tries (the ticks' climbs) and sessions (distinct days) up
 * to and including the day of its first real ascent. Repeats and falls after
 * it change nothing. A route never sent counts every tick. The pyramid tile's
 * numbers and the climb card's summary both come from here.
 */
export function countToFirstSend(ticks: Pick<ClimbRecord, "style" | "climbs" | "date">[]): {
  tries: number;
  sessions: number;
  sent: boolean;
} {
  let firstSend: string | null = null;
  for (const c of ticks) {
    if (REAL_ASCENT.has(c.style) && (firstSend === null || c.date < firstSend)) firstSend = c.date;
  }
  const counted = firstSend === null ? ticks : ticks.filter((c) => c.date <= firstSend);
  return {
    tries: counted.reduce((n, c) => n + c.climbs, 0),
    sessions: new Set(counted.map((c) => c.date)).size,
    sent: firstSend !== null,
  };
}

/**
 * The climb card's summary for a pyramid tile: "after 4 attempts over 2
 * sessions" for a redpoint that took falls, nothing for an onsight or flash,
 * and the running total for a route not sent yet.
 */
export function ascentSummary(
  climb: Pick<ClimbRecord, "style">,
  routeTicks: Pick<ClimbRecord, "style" | "climbs" | "date">[],
): string | null {
  const { tries, sessions, sent } = countToFirstSend(routeTicks);
  const over = sessions > 1 ? ` over ${plural(sessions, "session")}` : "";
  if (sent) return tries > 1 ? `after ${plural(tries - 1, "attempt")}${over}` : null;
  return tries > 0 ? `${plural(tries, climb.style === "attempt" ? "attempt" : "climb")}${over}` : null;
}

