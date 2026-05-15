import { SPORT_GRADES, BOULDER_GRADES } from "../constants/climbGrades";
import type { ClimbRecord } from "./climbs";
import type { ClimbStyle, ViewKey } from "../constants/climbGrades";

export function getStyleColor(style: ClimbStyle): string {
  switch (style) {
    case "onsight":  return "bg-green-500";
    case "flash":    return "bg-yellow-500";
    case "redpoint": return "bg-red-500";
    case "attempt":  return "bg-gray-400";
    default:         return "bg-gray-500";
  }
}

export type PyramidRow = { grade: string; climbs: ClimbRecord[] };

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

export function getFilteredClimbs(
  climbs: ClimbRecord[],
  currentView: ViewKey,
  showSendsOnly: boolean,
  timeRange: [number, number],
): ClimbRecord[] {
  const parts = currentView.split("-");
  const setting = parts[0];
  const type = parts.slice(1).join("-"); // handles "outdoor-sport" → setting="outdoor", type="sport"
  let filtered = climbs.filter((c) => c.setting === setting && c.type === type);

  if (showSendsOnly) {
    filtered = filtered.filter((c) => c.style !== "attempt");
  }

  if (filtered.length > 0) {
    const dates = filtered.map((c) => new Date(c.date).getTime()).sort((a, b) => a - b);
    const minDate = dates[0];
    const maxDate = dates[dates.length - 1];
    const totalRange = maxDate - minDate;

    if (totalRange > 0) {
      const startDate = minDate + (totalRange * timeRange[0]) / 100;
      const endDate = minDate + (totalRange * timeRange[1]) / 100;
      filtered = filtered.filter((c) => {
        const t = new Date(c.date).getTime();
        return t >= startDate && t <= endDate;
      });
    }
  }

  return filtered;
}

export type DateRangeInfo = {
  startDate: Date;
  endDate: Date;
  isFullRange: boolean;
  totalMinDate?: Date;
  totalMaxDate?: Date;
};

export function getDateRangeInfo(
  climbs: ClimbRecord[],
  timeRange: [number, number],
): DateRangeInfo | null {
  if (climbs.length === 0) return null;

  const allDates = climbs.map((c) => new Date(c.date).getTime()).sort((a, b) => a - b);
  const minDate = allDates[0];
  const maxDate = allDates[allDates.length - 1];
  const totalRange = maxDate - minDate;

  if (totalRange === 0) {
    return { startDate: new Date(minDate), endDate: new Date(maxDate), isFullRange: true };
  }

  const startDate = new Date(minDate + (totalRange * timeRange[0]) / 100);
  const endDate = new Date(minDate + (totalRange * timeRange[1]) / 100);

  return {
    startDate,
    endDate,
    isFullRange: timeRange[0] === 0 && timeRange[1] === 100,
    totalMinDate: new Date(minDate),
    totalMaxDate: new Date(maxDate),
  };
}
