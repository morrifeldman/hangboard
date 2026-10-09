// Local-calendar date helpers. Day keys are "YYYY-MM-DD" in the user's local
// timezone — never derive them with toISOString(), which is UTC and rolls over
// to tomorrow in the evening west of Greenwich.
//
// No DOM or app imports: the service worker bundles this file too.

/** Local "YYYY-MM-DD" for a Date or epoch-ms timestamp. */
export function toLocalDateString(d: Date | number): string {
  const date = typeof d === "number" ? new Date(d) : d;
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Local "HH:MM" for a Date or epoch-ms timestamp. */
export function toLocalTimeString(d: Date | number): string {
  const date = typeof d === "number" ? new Date(d) : d;
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function todayDateString(): string {
  return toLocalDateString(new Date());
}

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateKey(s: unknown): s is string {
  return typeof s === "string" && DATE_KEY_RE.test(s);
}

/**
 * Local noon on the given "YYYY-MM-DD". `new Date("2026-10-09")` parses as UTC
 * midnight, which is the previous evening anywhere west of UTC; noon keeps the
 * day stable in every timezone and across DST shifts.
 */
export function parseDateKey(key: string): Date {
  return new Date(`${key}T12:00:00`);
}

export function dateKeyToTime(key: string): number {
  return parseDateKey(key).getTime();
}

/** Monday-anchored start of week, set to local midnight. */
export function startOfWeek(d: Date | number): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  out.setDate(out.getDate() - ((out.getDay() + 6) % 7));
  return out;
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

/** "Oct 9, 2026" (or without the year) for a "YYYY-MM-DD" key. */
export function formatDateKey(key: string, opts: { year?: boolean; weekday?: boolean } = {}): string {
  return parseDateKey(key).toLocaleDateString(undefined, {
    ...(opts.weekday ? { weekday: "short" } : {}),
    month: "short",
    day: "numeric",
    ...(opts.year === false ? {} : { year: "numeric" }),
  });
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
