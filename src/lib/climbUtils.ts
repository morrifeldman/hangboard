import { SPORT_GRADES, BOULDER_GRADES } from "../constants/climbGrades";
import type { ClimbRecord } from "./climbs";
import { VIEWS } from "../constants/climbGrades";
import type { ClimbStyle, ViewKey } from "../constants/climbGrades";
import { dateKeyToTime } from "./dates";

// One colour per send style, used everywhere a climb's style is shown.
const STYLE_SOLID: Record<ClimbStyle, string> = {
  onsight: "bg-green-500",
  flash: "bg-yellow-500",
  redpoint: "bg-red-500",
  attempt: "bg-gray-400",
};

const STYLE_BADGE: Record<ClimbStyle, string> = {
  onsight: "bg-green-500/20 text-green-400",
  flash: "bg-yellow-500/20 text-yellow-400",
  redpoint: "bg-red-500/20 text-red-400",
  attempt: "bg-gray-700 text-gray-400",
};

/** Solid fill for a style (pyramid tiles, timeline dots, legend). */
export function getStyleColor(style: ClimbStyle): string {
  return STYLE_SOLID[style] ?? "bg-gray-500";
}

/** Tinted text badge for a style (lists and detail sheets). */
export function styleBadgeClass(style: string): string {
  return STYLE_BADGE[style as ClimbStyle] ?? STYLE_BADGE.attempt;
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

/** Climbs matching a pyramid view (setting + type). */
export function climbsInView(climbs: ClimbRecord[], view: ViewKey): ClimbRecord[] {
  const { setting, type } = viewDef(view);
  return climbs.filter((c) => c.setting === setting && c.type === type);
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
): ClimbRecord[] {
  const inView = climbsInView(climbs, view);
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
): DateRangeInfo | null {
  const w = timeWindow(climbsInView(climbs, view), timeRange);
  if (!w) return null;
  return {
    startDate: new Date(w.start),
    endDate: new Date(w.end),
    isFullRange: w.min === w.max || (timeRange[0] === 0 && timeRange[1] === 100),
  };
}
