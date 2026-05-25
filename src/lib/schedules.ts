import { getDB } from "./history";
import type { SessionRecord } from "./history";
import type { ClimbRecord } from "./climbs";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ScheduleDayType =
  | "power"
  | "endurance"
  | "hangboard"
  | "outdoor"
  | "bouldering"
  | "stretching"
  | "cardio"
  | "rest";

export const SCHEDULE_TYPE_META: Record<ScheduleDayType, { label: string; bg: string; dot: string }> = {
  power: { label: "Power", bg: "bg-red-600", dot: "bg-red-400" },
  endurance: { label: "Endurance", bg: "bg-blue-600", dot: "bg-blue-400" },
  hangboard: { label: "Hangboard", bg: "bg-indigo-600", dot: "bg-indigo-400" },
  outdoor: { label: "Outdoor", bg: "bg-teal-600", dot: "bg-teal-400" },
  bouldering: { label: "Bouldering", bg: "bg-amber-600", dot: "bg-amber-400" },
  stretching: { label: "Stretching", bg: "bg-purple-600", dot: "bg-purple-400" },
  cardio: { label: "Cardio", bg: "bg-emerald-600", dot: "bg-emerald-400" },
  rest: { label: "Rest", bg: "bg-gray-600", dot: "bg-gray-400" },
};

export const SCHEDULE_TYPE_ORDER: ScheduleDayType[] = [
  "power",
  "endurance",
  "hangboard",
  "outdoor",
  "bouldering",
  "stretching",
  "cardio",
  "rest",
];

export type ScheduleRecord = {
  id: string;
  date: string; // YYYY-MM-DD (local)
  dayTypes?: ScheduleDayType[];
  /** @deprecated legacy single-type field; read-only, kept for back-compat */
  dayType?: ScheduleDayType;
  note?: string;
  createdAt: number;
  updatedAt: number;
};

/** Normalize a record's planned types, folding the legacy single `dayType`. */
export function normalizeDayTypes(
  r: Pick<ScheduleRecord, "dayTypes" | "dayType"> | undefined | null,
): ScheduleDayType[] {
  if (!r) return [];
  if (r.dayTypes) return r.dayTypes;
  return r.dayType ? [r.dayType] : [];
}

export type Adherence =
  | "planned-and-logged"
  | "planned-not-logged"
  | "unplanned-logged"
  | "planned-future"
  | "none";

/** Per-planned-type completion state for a day. */
export type TypeStatus = {
  type: ScheduleDayType;
  state: "done" | "missed" | "upcoming";
};

export type ScheduleDay = {
  date: string;
  jsDate: Date;
  isToday: boolean;
  isPast: boolean;
  dayTypes: ScheduleDayType[];
  typeStatus: TypeStatus[];
  note?: string;
  logged: { sessions: SessionRecord[]; climbs: ClimbRecord[] };
  adherence: Adherence;
};

// ─── Generous per-type matching ───────────────────────────────────────────────

/**
 * Generously decide whether anything logged on a day could be construed as
 * satisfying a planned type. `rest` is special: it is "matched" when nothing
 * was logged, or when the only thing logged was stretching or cardio (both are
 * compatible with a rest day).
 */
export function typeMatches(
  type: ScheduleDayType,
  sessions: ReadonlyArray<SessionRecord>,
  climbs: ReadonlyArray<ClimbRecord>,
): boolean {
  const workouts = new Set(sessions.map((s) => s.workoutType));
  const has = (...kinds: SessionRecord["workoutType"][]) =>
    kinds.some((k) => workouts.has(k));
  const anyBoulder = climbs.some((c) => c.type === "boulder");
  const anySport = climbs.some((c) => c.type === "sport");

  switch (type) {
    case "hangboard":
      return has("repeaters", "max-hang", "beginner");
    case "power":
      // wbl is a warm-up boulder ladder, not a power session — excluded here.
      return (
        has("max-hang", "performance", "hard-bouldering", "limit-bouldering", "campus") ||
        anyBoulder
      );
    case "endurance":
      return has("repeaters", "arc", "cir", "pe-route", "lbc") || anySport;
    case "bouldering":
      return anyBoulder || has("hard-bouldering", "limit-bouldering", "wbl");
    case "outdoor":
      return climbs.some((c) => c.setting === "outdoor");
    case "stretching":
      return has("stretching");
    case "cardio":
      return has("cardio");
    case "rest":
      // Resting — or only stretching / cardio — keeps a rest day satisfied.
      return (
        climbs.length === 0 &&
        sessions.every((s) => s.workoutType === "stretching" || s.workoutType === "cardio")
      );
  }
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

export function toLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Monday-anchored start of week, set to local midnight. */
export function startOfWeek(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  const day = out.getDay(); // 0=Sun … 6=Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  out.setDate(out.getDate() + diffToMonday);
  return out;
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

export function buildScheduleWeeks(
  startDate: Date,
  weekCount: number,
  schedules: ReadonlyArray<ScheduleRecord>,
  sessions: ReadonlyArray<SessionRecord>,
  climbs: ReadonlyArray<ClimbRecord>,
  today: Date = new Date(),
): ScheduleDay[][] {
  const todayKey = toLocalDateString(today);

  const planByDate = new Map<string, ScheduleRecord>();
  for (const s of schedules) planByDate.set(s.date, s);

  const sessionsByDate = new Map<string, SessionRecord[]>();
  for (const s of sessions) {
    const key = toLocalDateString(new Date(s.startedAt));
    const list = sessionsByDate.get(key) ?? [];
    list.push(s);
    sessionsByDate.set(key, list);
  }

  const climbsByDate = new Map<string, ClimbRecord[]>();
  for (const c of climbs) {
    const list = climbsByDate.get(c.date) ?? [];
    list.push(c);
    climbsByDate.set(c.date, list);
  }

  const weeks: ScheduleDay[][] = [];
  for (let w = 0; w < weekCount; w++) {
    const week: ScheduleDay[] = [];
    for (let d = 0; d < 7; d++) {
      const jsDate = addDays(startDate, w * 7 + d);
      const date = toLocalDateString(jsDate);
      const plan = planByDate.get(date);
      const daySessions = sessionsByDate.get(date) ?? [];
      const dayClimbs = climbsByDate.get(date) ?? [];
      const hasLog = daySessions.length + dayClimbs.length > 0;
      const isToday = date === todayKey;
      const isPast = date < todayKey;

      const dayTypes = normalizeDayTypes(plan);
      const planned = dayTypes.length > 0;

      const typeStatus: TypeStatus[] = dayTypes.map((type) => {
        if (typeMatches(type, daySessions, dayClimbs)) return { type, state: "done" };
        return { type, state: isPast ? "missed" : "upcoming" };
      });

      let adherence: Adherence;
      if (planned && hasLog) adherence = "planned-and-logged";
      else if (planned && !hasLog && isPast) adherence = "planned-not-logged";
      else if (planned && !hasLog) adherence = "planned-future";
      else if (!planned && hasLog) adherence = "unplanned-logged";
      else adherence = "none";

      week.push({
        date,
        jsDate,
        isToday,
        isPast,
        dayTypes,
        typeStatus,
        note: plan?.note,
        logged: { sessions: daySessions, climbs: dayClimbs },
        adherence,
      });
    }
    weeks.push(week);
  }
  return weeks;
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

const STORE = "schedules";

export async function getSchedules(): Promise<ScheduleRecord[]> {
  const db = await getDB();
  const all = (await db.getAll(STORE)) as ScheduleRecord[];
  return all.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export async function getSchedule(date: string): Promise<ScheduleRecord | undefined> {
  const db = await getDB();
  return (await db.getFromIndex(STORE, "by-date", date)) as ScheduleRecord | undefined;
}

/**
 * Insert or replace the schedule for a given date. The by-date index is unique,
 * so we do the lookup and the write inside one transaction to avoid races.
 * If a record for the date already exists, we reuse its id (idempotent updates).
 *
 * Pass `dayType` and/or `note` to set those fields. Pass `undefined` to leave a
 * field unchanged on an existing record. If both fields end up empty, the
 * record is deleted.
 */
export async function upsertSchedule(input: {
  date: string;
  dayTypes?: ScheduleDayType[];
  note?: string;
}): Promise<ScheduleRecord | undefined> {
  const db = await getDB();
  const tx = db.transaction(STORE, "readwrite");
  const index = tx.store.index("by-date");
  const existing = (await index.get(input.date)) as ScheduleRecord | undefined;

  const nextDayTypes =
    "dayTypes" in input ? (input.dayTypes ?? []) : normalizeDayTypes(existing);
  const trimmedNote = input.note?.trim();
  const nextNote =
    "note" in input ? (trimmedNote ? trimmedNote : undefined) : existing?.note;

  if (nextDayTypes.length === 0 && !nextNote) {
    if (existing) await tx.store.delete(existing.id);
    await tx.done;
    return undefined;
  }

  const now = Date.now();
  const base = existing
    ? { ...existing, updatedAt: now }
    : { id: crypto.randomUUID(), date: input.date, createdAt: now, updatedAt: now };
  // Drop the legacy single-type field; persist the array form going forward.
  const record: ScheduleRecord = {
    ...base,
    dayTypes: nextDayTypes,
    dayType: undefined,
    note: nextNote,
  };
  await tx.store.put(record);
  await tx.done;
  return record;
}

export async function deleteSchedule(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE, id);
}

export async function deleteScheduleByDate(date: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORE, "readwrite");
  const existing = (await tx.store.index("by-date").get(date)) as ScheduleRecord | undefined;
  if (existing) await tx.store.delete(existing.id);
  await tx.done;
}

export async function clearSchedules(): Promise<void> {
  const db = await getDB();
  await db.clear(STORE);
}

export async function replaceAllSchedules(records: ScheduleRecord[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORE, "readwrite");
  await tx.store.clear();
  for (const r of records) {
    await tx.store.put(r);
  }
  await tx.done;
}
