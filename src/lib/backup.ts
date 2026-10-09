import { getSessions } from "./history";
import type { SessionRecord } from "./history";
import { getClimbs } from "./climbs";
import type { ClimbRecord } from "./climbs";
import { getSchedules } from "./schedules";
import type { ScheduleRecord } from "./schedules";
import { getNotes } from "./notes";
import type { NoteRecord } from "./notes";
import { replaceStores } from "./db";
import { isDateKey, toLocalDateString } from "./dates";
import { useWorkoutStore } from "../store/useWorkoutStore";
import type { StoredWeights } from "../store/useWorkoutStore";
import type { LiftDefinition } from "./lifts";

export type BackupSelectedWorkout = "repeaters" | "max-hang";

export type BackupData = {
  sessions: SessionRecord[];
  climbs: ClimbRecord[];
  schedules: ScheduleRecord[];
  notes: NoteRecord[];
  weights: StoredWeights;
  weightsB: StoredWeights;
  selectedWorkout: BackupSelectedWorkout;
  gymDefaults: Record<string, Record<string, string>>;
  lifts: LiftDefinition[];
  mountainProjectUrl: string;
};

export type BackupFile = {
  app: "hangboard";
  version: 1;
  exportedAt: number;
  data: BackupData;
};

export const MP_URL_KEY = "mountainProjectUrl";

export type BuildBackupArgs = {
  sessions: SessionRecord[];
  climbs: ClimbRecord[];
  schedules: ScheduleRecord[];
  notes: NoteRecord[];
  weights: StoredWeights;
  weightsB: StoredWeights;
  selectedWorkout: BackupSelectedWorkout;
  gymDefaults: Record<string, Record<string, string>>;
  lifts: LiftDefinition[];
  mountainProjectUrl: string;
  now?: number;
};

export function buildBackup(args: BuildBackupArgs): BackupFile {
  return {
    app: "hangboard",
    version: 1,
    exportedAt: args.now ?? Date.now(),
    data: {
      sessions: args.sessions,
      climbs: args.climbs,
      schedules: args.schedules,
      notes: args.notes,
      weights: args.weights,
      weightsB: args.weightsB,
      selectedWorkout: args.selectedWorkout,
      gymDefaults: args.gymDefaults,
      lifts: args.lifts,
      mountainProjectUrl: args.mountainProjectUrl,
    },
  };
}

type ValidateResult =
  | { ok: true; file: BackupFile }
  | { ok: false; error: string };

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// Per-record checks. Restore replaces everything, so a malformed record must
// be caught here — not halfway through writing the database.
type Check = (r: Record<string, unknown>) => string | null;

const isFiniteNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const hasId: Check = (r) => (typeof r.id === "string" && r.id !== "" ? null : "id must be a non-empty string");
const hasDateKey: Check = (r) => (isDateKey(r.date) ? null : "date must be YYYY-MM-DD");

const RECORD_CHECKS: Record<"sessions" | "climbs" | "schedules" | "notes" | "lifts", Check[]> = {
  sessions: [
    hasId,
    (r) => (typeof r.workoutType === "string" ? null : "workoutType must be a string"),
    (r) => (isFiniteNumber(r.startedAt) && isFiniteNumber(r.completedAt) ? null : "startedAt/completedAt must be numbers"),
    (r) => (Array.isArray(r.holds) ? null : "holds must be an array"),
  ],
  climbs: [
    hasId,
    hasDateKey,
    (r) => (typeof r.route === "string" && typeof r.grade === "string" ? null : "route and grade must be strings"),
  ],
  schedules: [hasId, hasDateKey],
  notes: [
    hasId,
    hasDateKey,
    (r) => (typeof r.text === "string" ? null : "text must be a string"),
  ],
  lifts: [hasId, (r) => (typeof r.name === "string" ? null : "name must be a string")],
};

function checkRecords(field: keyof typeof RECORD_CHECKS, list: unknown[]): string | null {
  for (let i = 0; i < list.length; i++) {
    const r = list[i];
    if (!isObject(r)) return `data.${field}[${i}] must be an object.`;
    for (const check of RECORD_CHECKS[field]) {
      const problem = check(r);
      if (problem) return `data.${field}[${i}]: ${problem}.`;
    }
  }
  return null;
}

function checkWeights(field: string, map: Record<string, unknown>): string | null {
  for (const [holdId, w] of Object.entries(map)) {
    if (!isObject(w) || !isFiniteNumber(w.set1) || !isFiniteNumber(w.set2)) {
      return `data.${field}.${holdId} must have numeric set1 and set2.`;
    }
  }
  return null;
}

/** Schedule dates are a unique index: keep the most recently updated record per date. */
function dedupeSchedules(list: ScheduleRecord[]): ScheduleRecord[] {
  const byDate = new Map<string, ScheduleRecord>();
  for (const r of list) {
    const prev = byDate.get(r.date);
    if (!prev || (r.updatedAt ?? 0) >= (prev.updatedAt ?? 0)) byDate.set(r.date, r);
  }
  return [...byDate.values()];
}

export function validateBackup(parsed: unknown): ValidateResult {
  if (!isObject(parsed)) return { ok: false, error: "File is not a JSON object." };
  if (parsed.app !== "hangboard") {
    return { ok: false, error: "Not a Cairn backup file (missing app marker)." };
  }
  if (parsed.version !== 1) {
    return { ok: false, error: `Unsupported backup version: ${String(parsed.version)}. Expected 1.` };
  }
  if (typeof parsed.exportedAt !== "number") {
    return { ok: false, error: "Missing or invalid exportedAt." };
  }
  const data = parsed.data;
  if (!isObject(data)) return { ok: false, error: "Missing data section." };
  // Schedules, notes and the lift library were added after v1 of the backup
  // format; older files may omit them.
  for (const field of ["schedules", "notes", "lifts"] as const) {
    if (data[field] === undefined) data[field] = [];
  }
  for (const field of ["sessions", "climbs", "schedules", "notes", "lifts"] as const) {
    const list = data[field];
    if (!Array.isArray(list)) return { ok: false, error: `data.${field} must be an array.` };
    const problem = checkRecords(field, list);
    if (problem) return { ok: false, error: problem };
  }
  for (const field of ["weights", "weightsB"] as const) {
    const map = data[field];
    if (!isObject(map)) return { ok: false, error: `data.${field} must be an object.` };
    const problem = checkWeights(field, map);
    if (problem) return { ok: false, error: problem };
  }
  if (data.selectedWorkout !== "repeaters" && data.selectedWorkout !== "max-hang") {
    return { ok: false, error: "data.selectedWorkout must be 'repeaters' or 'max-hang'." };
  }
  if (!isObject(data.gymDefaults)) return { ok: false, error: "data.gymDefaults must be an object." };
  if (typeof data.mountainProjectUrl !== "string") {
    return { ok: false, error: "data.mountainProjectUrl must be a string." };
  }
  data.schedules = dedupeSchedules(data.schedules as ScheduleRecord[]);
  return { ok: true, file: parsed as unknown as BackupFile };
}

export async function exportBackup(): Promise<BackupFile> {
  const [sessions, climbs, schedules, notes] = await Promise.all([
    getSessions(),
    getClimbs(),
    getSchedules(),
    getNotes(),
  ]);
  const s = useWorkoutStore.getState();
  const selected: BackupSelectedWorkout = s.selectedWorkout === "max-hang" ? "max-hang" : "repeaters";
  return buildBackup({
    sessions,
    climbs,
    schedules,
    notes,
    weights: s.weights,
    weightsB: s.weightsB,
    selectedWorkout: selected,
    gymDefaults: s.gymDefaults,
    lifts: s.lifts,
    mountainProjectUrl: localStorage.getItem(MP_URL_KEY) ?? "",
  });
}

export async function restoreBackup(file: BackupFile): Promise<void> {
  const { data } = file;
  // One transaction: if any record is rejected, the database is left as it was,
  // and the settings below are only applied once the records are in.
  await replaceStores({
    sessions: data.sessions,
    climbs: data.climbs,
    schedules: data.schedules,
    notes: data.notes,
  });
  useWorkoutStore.setState({
    weights: data.weights,
    weightsB: data.weightsB,
    selectedWorkout: data.selectedWorkout,
    gymDefaults: data.gymDefaults,
    lifts: data.lifts,
  });
  localStorage.setItem(MP_URL_KEY, data.mountainProjectUrl);
}

export function backupFilename(now: number = Date.now()): string {
  return `cairn-backup-${toLocalDateString(now)}.json`;
}
