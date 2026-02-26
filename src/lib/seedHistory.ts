import { HOLDS } from "../data/holds";
import { HOLDS_B } from "../data/workout-b";
import { addSession, getSessions } from "./history";
import type { SessionRecord, SessionHoldRecord } from "./history";

function ts(daysBack: number, hour = 9): number {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  d.setHours(hour, 30, 0, 0);
  return d.getTime();
}

function repeaters(
  daysBack: number,
  delta: number, // kg added to every hold's defaults
  opts: { notes?: string; bailed?: boolean; imported?: boolean; durationMins?: number } = {}
): SessionRecord {
  const start = opts.imported ? new Date(`${new Date(ts(daysBack)).toISOString().slice(0, 10)}T12:00:00`).getTime() : ts(daysBack);
  const end = opts.imported ? start : start + (opts.durationMins ?? 46) * 60_000;

  const holds: SessionHoldRecord[] = HOLDS.map((hold) => ({
    holdId: hold.id,
    holdName: hold.name,
    set1: { weight: hold.defaultSet1Weight + delta, reps: hold.repsPerSet ?? hold.set1Reps, completed: !opts.bailed },
    set2: { weight: hold.defaultSet2Weight + delta, reps: hold.repsPerSet ?? hold.set2Reps, completed: !opts.bailed },
  }));

  return {
    id: crypto.randomUUID(),
    workoutType: "a",
    startedAt: start,
    completedAt: end,
    bailed: opts.bailed ?? false,
    holds,
    ...(opts.notes ? { notes: opts.notes } : {}),
    ...(opts.imported ? { imported: true } : {}),
  };
}

function maxHang(
  daysBack: number,
  delta: number,
  opts: { notes?: string; durationMins?: number } = {}
): SessionRecord {
  const start = ts(daysBack, 7);
  const end = start + (opts.durationMins ?? 52) * 60_000;

  const holds: SessionHoldRecord[] = HOLDS_B.map((hold) => {
    const w = hold.isRestOnly || hold.skipProgression ? 0 : hold.defaultSet1Weight + delta;
    const numSets = hold.numSets ?? 2;
    return {
      holdId: hold.id,
      holdName: hold.name,
      set1: { weight: w, reps: hold.repsPerSet ?? hold.set1Reps, completed: true },
      set2: numSets >= 2 ? { weight: w, reps: hold.repsPerSet ?? hold.set2Reps, completed: true } : null,
    };
  });

  return {
    id: crypto.randomUUID(),
    workoutType: "b",
    startedAt: start,
    completedAt: end,
    bailed: false,
    holds,
    ...(opts.notes ? { notes: opts.notes } : {}),
  };
}

let seedPromise: Promise<void> | null = null;

export function seedTestHistory(): Promise<void> {
  if (!seedPromise) seedPromise = doSeed();
  return seedPromise;
}

async function doSeed(): Promise<void> {
  const existing = await getSessions();
  if (existing.length > 0) return;

  const sessions: SessionRecord[] = [
    // ── Older paper-journal imports ──────────────────────────────────────────
    repeaters(63, -5,   { imported: true, notes: "backfilled from paper journal" }),
    repeaters(57, -5,   { imported: true }),
    repeaters(50, -5,   { imported: true, notes: "felt a bit off" }),
    repeaters(43, -2.5, { imported: true }),
    repeaters(36, -2.5, { imported: true }),

    // ── Live sessions from recent weeks ─────────────────────────────────────
    maxHang(28, -2.5,   { notes: "first max hang session" }),
    repeaters(25, 0),
    maxHang(22, 0),
    repeaters(19, 0,    { notes: "wide pinch feeling weak" }),
    maxHang(15, 0,      { notes: "good session" }),
    repeaters(12, 0),
    maxHang(8, 2.5),
    repeaters(5, 2.5,   { notes: "nearly bailed on sloper but pushed through" }),
    maxHang(3, 2.5),
    repeaters(1, 2.5),
  ];

  for (const s of sessions) {
    await addSession(s);
  }
}
