import type { ClimbRecord } from "./climbs";

export type DateRange = { start: string; end: string }; // inclusive, YYYY-MM-DD

export type WindowKind = "seasons" | "years" | "halves-fw-ss" | "halves-ws-sf";

export type SeasonWindow = {
  id: string;
  label: string;
  kind: WindowKind;
  ranges: DateRange[];
};

export function isInWindow(date: string, window: SeasonWindow): boolean {
  return window.ranges.some((r) => date >= r.start && date <= r.end);
}

export function filterClimbsByWindow(
  climbs: ClimbRecord[],
  window: SeasonWindow,
): ClimbRecord[] {
  return climbs.filter((c) => isInWindow(c.date, window));
}

// ─── Window factories ─────────────────────────────────────────────────────────

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function yy(year: number): string {
  return String(year).slice(2);
}

function lastDayOfFeb(year: number): string {
  // year is the year of February; new Date(year, 2, 0) = Feb 28/29 of `year`
  return pad2(new Date(year, 2, 0).getDate());
}

function calendarYearWindow(year: number): SeasonWindow {
  return {
    id: `year-${year}`,
    label: `${year}`,
    kind: "years",
    ranges: [{ start: `${year}-01-01`, end: `${year}-12-31` }],
  };
}

function springWindow(year: number): SeasonWindow {
  return {
    id: `spring-${year}`,
    label: `Spring ${year}`,
    kind: "seasons",
    ranges: [{ start: `${year}-03-01`, end: `${year}-05-31` }],
  };
}

function summerWindow(year: number): SeasonWindow {
  return {
    id: `summer-${year}`,
    label: `Summer ${year}`,
    kind: "seasons",
    ranges: [{ start: `${year}-06-01`, end: `${year}-08-31` }],
  };
}

function fallWindow(year: number): SeasonWindow {
  return {
    id: `fall-${year}`,
    label: `Fall ${year}`,
    kind: "seasons",
    ranges: [{ start: `${year}-09-01`, end: `${year}-11-30` }],
  };
}

/** Winter spans Dec of `startYear` through Feb of the following year. */
function winterWindow(startYear: number): SeasonWindow {
  const next = startYear + 1;
  return {
    id: `winter-${startYear}`,
    label: `Winter ${yy(startYear)}–${yy(next)}`,
    kind: "seasons",
    ranges: [{ start: `${startYear}-12-01`, end: `${next}-02-${lastDayOfFeb(next)}` }],
  };
}

/** Fall+Winter spans Sep of `startYear` through Feb of the following year. */
function fallWinterWindow(startYear: number): SeasonWindow {
  const next = startYear + 1;
  return {
    id: `fw-${startYear}`,
    label: `Fall+Winter ${yy(startYear)}–${yy(next)}`,
    kind: "halves-fw-ss",
    ranges: [{ start: `${startYear}-09-01`, end: `${next}-02-${lastDayOfFeb(next)}` }],
  };
}

function springSummerWindow(year: number): SeasonWindow {
  return {
    id: `ss-${year}`,
    label: `Spring+Summer ${year}`,
    kind: "halves-fw-ss",
    ranges: [{ start: `${year}-03-01`, end: `${year}-08-31` }],
  };
}

/** Winter+Spring spans Dec of `startYear` through May of the following year. */
function winterSpringWindow(startYear: number): SeasonWindow {
  const next = startYear + 1;
  return {
    id: `ws-${startYear}`,
    label: `Winter+Spring ${yy(startYear)}–${yy(next)}`,
    kind: "halves-ws-sf",
    ranges: [{ start: `${startYear}-12-01`, end: `${next}-05-31` }],
  };
}

function summerFallWindow(year: number): SeasonWindow {
  return {
    id: `sf-${year}`,
    label: `Summer+Fall ${year}`,
    kind: "halves-ws-sf",
    ranges: [{ start: `${year}-06-01`, end: `${year}-11-30` }],
  };
}

// ─── Date → window mapping ────────────────────────────────────────────────────

function windowForDate(date: string, kind: WindowKind): SeasonWindow | null {
  const [y, m] = date.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return null;

  if (kind === "years") return calendarYearWindow(y);

  if (kind === "seasons") {
    if (m >= 3 && m <= 5) return springWindow(y);
    if (m >= 6 && m <= 8) return summerWindow(y);
    if (m >= 9 && m <= 11) return fallWindow(y);
    // Dec → Winter of y; Jan–Feb → Winter of y-1
    return winterWindow(m === 12 ? y : y - 1);
  }

  if (kind === "halves-fw-ss") {
    if (m >= 9 && m <= 12) return fallWinterWindow(y);
    if (m >= 1 && m <= 2) return fallWinterWindow(y - 1);
    return springSummerWindow(y); // Mar–Aug
  }

  // halves-ws-sf
  if (m === 12) return winterSpringWindow(y);
  if (m >= 1 && m <= 5) return winterSpringWindow(y - 1);
  return summerFallWindow(y); // Jun–Nov
}

/**
 * Emit one window per period that contains at least one climb. Newest-first,
 * ordered by the window's start date.
 */
export function generateWindows(
  climbs: ClimbRecord[],
  kind: WindowKind,
): SeasonWindow[] {
  const byId = new Map<string, SeasonWindow>();
  for (const c of climbs) {
    const w = windowForDate(c.date, kind);
    if (w) byId.set(w.id, w);
  }
  return [...byId.values()].sort((a, b) =>
    b.ranges[0].start.localeCompare(a.ranges[0].start),
  );
}
