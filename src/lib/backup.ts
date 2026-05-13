import { getSessions, replaceAllSessions } from "./history";
import type { SessionRecord } from "./history";
import { getClimbs, replaceAllClimbs } from "./climbs";
import type { ClimbRecord } from "./climbs";
import { useWorkoutStore } from "../store/useWorkoutStore";
import type { StoredWeights } from "../store/useWorkoutStore";

export type BackupSelectedWorkout = "repeaters" | "max-hang";

export type BackupData = {
  sessions: SessionRecord[];
  climbs: ClimbRecord[];
  weights: StoredWeights;
  weightsB: StoredWeights;
  selectedWorkout: BackupSelectedWorkout;
  gymDefaults: Record<string, Record<string, string>>;
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
  weights: StoredWeights;
  weightsB: StoredWeights;
  selectedWorkout: BackupSelectedWorkout;
  gymDefaults: Record<string, Record<string, string>>;
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
      weights: args.weights,
      weightsB: args.weightsB,
      selectedWorkout: args.selectedWorkout,
      gymDefaults: args.gymDefaults,
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

export function validateBackup(parsed: unknown): ValidateResult {
  if (!isObject(parsed)) return { ok: false, error: "File is not a JSON object." };
  if (parsed.app !== "hangboard") {
    return { ok: false, error: "Not a Hangboard backup file (missing app marker)." };
  }
  if (parsed.version !== 1) {
    return { ok: false, error: `Unsupported backup version: ${String(parsed.version)}. Expected 1.` };
  }
  if (typeof parsed.exportedAt !== "number") {
    return { ok: false, error: "Missing or invalid exportedAt." };
  }
  const data = parsed.data;
  if (!isObject(data)) return { ok: false, error: "Missing data section." };
  if (!Array.isArray(data.sessions)) return { ok: false, error: "data.sessions must be an array." };
  if (!Array.isArray(data.climbs)) return { ok: false, error: "data.climbs must be an array." };
  if (!isObject(data.weights)) return { ok: false, error: "data.weights must be an object." };
  if (!isObject(data.weightsB)) return { ok: false, error: "data.weightsB must be an object." };
  if (data.selectedWorkout !== "repeaters" && data.selectedWorkout !== "max-hang") {
    return { ok: false, error: "data.selectedWorkout must be 'repeaters' or 'max-hang'." };
  }
  if (!isObject(data.gymDefaults)) return { ok: false, error: "data.gymDefaults must be an object." };
  if (typeof data.mountainProjectUrl !== "string") {
    return { ok: false, error: "data.mountainProjectUrl must be a string." };
  }
  return { ok: true, file: parsed as unknown as BackupFile };
}

export async function exportBackup(): Promise<BackupFile> {
  const [sessions, climbs] = await Promise.all([getSessions(), getClimbs()]);
  const s = useWorkoutStore.getState();
  const selected: BackupSelectedWorkout = s.selectedWorkout === "max-hang" ? "max-hang" : "repeaters";
  return buildBackup({
    sessions,
    climbs,
    weights: s.weights,
    weightsB: s.weightsB,
    selectedWorkout: selected,
    gymDefaults: s.gymDefaults,
    mountainProjectUrl: localStorage.getItem(MP_URL_KEY) ?? "",
  });
}

export async function restoreBackup(file: BackupFile): Promise<void> {
  const { data } = file;
  await replaceAllSessions(data.sessions);
  await replaceAllClimbs(data.climbs);
  useWorkoutStore.setState({
    weights: data.weights,
    weightsB: data.weightsB,
    selectedWorkout: data.selectedWorkout,
    gymDefaults: data.gymDefaults,
  });
  localStorage.setItem(MP_URL_KEY, data.mountainProjectUrl);
}

export function backupFilename(now: number = Date.now()): string {
  const d = new Date(now);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `hangboard-backup-${yyyy}-${mm}-${dd}.json`;
}
