import { SPORT_GRADES, BOULDER_GRADES } from "../constants/climbGrades";
import type { ClimbRecord } from "./climbs";
import { VIEWS } from "../constants/climbGrades";
import type { ClimbStyle, ViewKey } from "../constants/climbGrades";
import { dateKeyToTime } from "./dates";

export function getStyleColor(style: ClimbStyle): string {
  switch (style) {
    case "onsight":  return "bg-green-500";
    case "flash":    return "bg-yellow-500";
    case "redpoint": return "bg-red-500";
    case "attempt":  return "bg-gray-400";
    default:         return "bg-gray-500";
  }
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
