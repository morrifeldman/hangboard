import type { ClimbRecord } from "./climbs";
import { SPORT_GRADES } from "../constants/climbGrades";

export type Granularity = "months" | "seasons" | "years";

export type GradeTrendPoint = {
  key: string;        // unique bucket id, also used for X-axis label data
  label: string;      // human-readable
  bucketStart: string; // YYYY-MM-DD — for sorting and slider mapping
  onsight: number | null;  // SPORT_GRADES index or null
  flash: number | null;
  redpoint: number | null;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ─── Bucket key + label per granularity ──────────────────────────────────────

function monthKey(date: string): string {
  return date.slice(0, 7); // YYYY-MM
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${String(y).slice(2)}`;
}

function yearKey(date: string): string {
  return date.slice(0, 4);
}

function yearLabel(key: string): string {
  return key;
}

type SeasonKind = "spring" | "summer" | "fall" | "winter";

function seasonForDate(date: string): { kind: SeasonKind; year: number } {
  const [y, m] = date.split("-").map(Number);
  if (m >= 3 && m <= 5) return { kind: "spring", year: y };
  if (m >= 6 && m <= 8) return { kind: "summer", year: y };
  if (m >= 9 && m <= 11) return { kind: "fall", year: y };
  // Dec → winter of y; Jan–Feb → winter of y-1
  return { kind: "winter", year: m === 12 ? y : y - 1 };
}

function seasonKey(date: string): string {
  const s = seasonForDate(date);
  return `${s.kind}-${s.year}`;
}

function seasonLabel(key: string): string {
  const [kind, yStr] = key.split("-");
  const y = Number(yStr);
  const yy = String(y).slice(2);
  if (kind === "winter") {
    const next = String(y + 1).slice(2);
    return `Winter ${yy}–${next}`;
  }
  return `${kind[0].toUpperCase()}${kind.slice(1)} ${yy}`;
}

function bucketKey(date: string, kind: Granularity): string {
  if (kind === "months") return monthKey(date);
  if (kind === "years") return yearKey(date);
  return seasonKey(date);
}

function bucketLabel(key: string, kind: Granularity): string {
  if (kind === "months") return monthLabel(key);
  if (kind === "years") return yearLabel(key);
  return seasonLabel(key);
}

// First day of the bucket — used for sorting and slider range.
function bucketStart(key: string, kind: Granularity): string {
  if (kind === "months") return `${key}-01`;
  if (kind === "years") return `${key}-01-01`;
  // seasons
  const [season, yStr] = key.split("-");
  const y = Number(yStr);
  if (season === "spring") return `${y}-03-01`;
  if (season === "summer") return `${y}-06-01`;
  if (season === "fall")   return `${y}-09-01`;
  return `${y}-12-01`; // winter
}

// ─── Full bucket enumeration between two anchor dates ────────────────────────

function enumerateMonths(from: string, to: string): string[] {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  const out: string[] = [];
  let y = fy, m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${pad2(m)}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}

function enumerateYears(fromY: number, toY: number): string[] {
  const out: string[] = [];
  for (let y = fromY; y <= toY; y++) out.push(String(y));
  return out;
}

// Chronological order within a "season-year" label. Winter is the end of its
// labeled year (Dec) and the next season after winter-Y is spring-(Y+1).
const SEASON_ORDER: SeasonKind[] = ["spring", "summer", "fall", "winter"];

function nextSeason(kind: SeasonKind, year: number): { kind: SeasonKind; year: number } {
  if (kind === "winter") return { kind: "spring", year: year + 1 };
  const i = SEASON_ORDER.indexOf(kind);
  return { kind: SEASON_ORDER[i + 1], year };
}

function seasonLessOrEqual(a: { kind: SeasonKind; year: number }, b: { kind: SeasonKind; year: number }): boolean {
  if (a.year !== b.year) return a.year < b.year;
  return SEASON_ORDER.indexOf(a.kind) <= SEASON_ORDER.indexOf(b.kind);
}

function enumerateSeasons(fromDate: string, toDate: string): string[] {
  const from = seasonForDate(fromDate);
  const to = seasonForDate(toDate);
  const out: string[] = [];
  let cur = from;
  while (seasonLessOrEqual(cur, to)) {
    out.push(`${cur.kind}-${cur.year}`);
    cur = nextSeason(cur.kind, cur.year);
  }
  return out;
}

export function enumerateBuckets(fromDate: string, toDate: string, kind: Granularity): string[] {
  if (kind === "months") return enumerateMonths(fromDate.slice(0, 7), toDate.slice(0, 7));
  if (kind === "years") return enumerateYears(Number(fromDate.slice(0, 4)), Number(toDate.slice(0, 4)));
  return enumerateSeasons(fromDate, toDate);
}

// ─── Main aggregation ────────────────────────────────────────────────────────

const GRADE_INDEX = new Map<string, number>(SPORT_GRADES.map((g, i) => [g, i]));

function gradeIndex(grade: string): number | null {
  const i = GRADE_INDEX.get(grade);
  return i === undefined ? null : i;
}

/**
 * Build the grade-trend series for the given climbs.
 * Filters to `outdoor` + `sport` setting/type, buckets by granularity, and
 * computes the max-grade index per style per bucket. Empty buckets between
 * min and max climb date are emitted with all-null values so the X axis
 * stays evenly spaced (and so Recharts can render gaps in the lines).
 */
export function buildGradeTrend(climbs: ClimbRecord[], kind: Granularity): GradeTrendPoint[] {
  const filtered = climbs.filter((c) => c.setting === "outdoor" && c.type === "sport");
  if (filtered.length === 0) return [];

  // bucket → per-style max index
  type Agg = { onsight: number | null; flash: number | null; redpoint: number | null };
  const byKey = new Map<string, Agg>();
  let minDate = filtered[0].date;
  let maxDate = filtered[0].date;

  for (const c of filtered) {
    if (c.date < minDate) minDate = c.date;
    if (c.date > maxDate) maxDate = c.date;
    if (c.style === "attempt") continue;
    const gi = gradeIndex(c.grade);
    if (gi === null) continue;
    const k = bucketKey(c.date, kind);
    let agg = byKey.get(k);
    if (!agg) { agg = { onsight: null, flash: null, redpoint: null }; byKey.set(k, agg); }
    const cur = agg[c.style];
    if (cur === null || gi > cur) agg[c.style] = gi;
  }

  const allKeys = enumerateBuckets(minDate, maxDate, kind);
  return allKeys.map((k) => {
    const agg = byKey.get(k) ?? { onsight: null, flash: null, redpoint: null };
    return {
      key: k,
      label: bucketLabel(k, kind),
      bucketStart: bucketStart(k, kind),
      onsight: agg.onsight,
      flash: agg.flash,
      redpoint: agg.redpoint,
    };
  });
}

export function gradeLabel(index: number): string {
  return SPORT_GRADES[index] ?? "";
}
