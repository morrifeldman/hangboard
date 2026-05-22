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
  | "rest";

export const SCHEDULE_TYPE_META: Record<ScheduleDayType, { label: string; bg: string }> = {
  power: { label: "Power", bg: "bg-red-600" },
  endurance: { label: "Endurance", bg: "bg-blue-600" },
  hangboard: { label: "Hangboard", bg: "bg-indigo-600" },
  outdoor: { label: "Outdoor", bg: "bg-teal-600" },
  bouldering: { label: "Bouldering", bg: "bg-amber-600" },
  rest: { label: "Rest", bg: "bg-gray-600" },
};

export const SCHEDULE_TYPE_ORDER: ScheduleDayType[] = [
  "power",
  "endurance",
  "hangboard",
  "outdoor",
  "bouldering",
  "rest",
];

export type ScheduleRecord = {
  id: string;
  date: string; // YYYY-MM-DD (local)
  dayType?: ScheduleDayType;
  note?: string;
  createdAt: number;
  updatedAt: number;
};

export type Adherence =
  | "planned-and-logged"
  | "planned-not-logged"
  | "unplanned-logged"
  | "planned-future"
  | "none";

export type ScheduleDay = {
  date: string;
  jsDate: Date;
  isToday: boolean;
  isPast: boolean;
  dayType?: ScheduleDayType;
  note?: string;
  logged: { sessions: SessionRecord[]; climbs: ClimbRecord[] };
  adherence: Adherence;
};

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

      const planned = !!plan?.dayType;
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
        dayType: plan?.dayType,
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
  dayType?: ScheduleDayType;
  note?: string;
}): Promise<ScheduleRecord | undefined> {
  const db = await getDB();
  const tx = db.transaction(STORE, "readwrite");
  const index = tx.store.index("by-date");
  const existing = (await index.get(input.date)) as ScheduleRecord | undefined;

  const nextDayType =
    "dayType" in input ? input.dayType : existing?.dayType;
  const trimmedNote = input.note?.trim();
  const nextNote =
    "note" in input ? (trimmedNote ? trimmedNote : undefined) : existing?.note;

  if (!nextDayType && !nextNote) {
    if (existing) await tx.store.delete(existing.id);
    await tx.done;
    return undefined;
  }

  const now = Date.now();
  const record: ScheduleRecord = existing
    ? { ...existing, dayType: nextDayType, note: nextNote, updatedAt: now }
    : {
        id: crypto.randomUUID(),
        date: input.date,
        dayType: nextDayType,
        note: nextNote,
        createdAt: now,
        updatedAt: now,
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
