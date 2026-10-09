import { WEIGHT_STEP } from "./format";
import type { SessionRecord } from "./history";
import type { TrendPoint } from "./progressData";

// ─── Types ───────────────────────────────────────────────────────────────────

/** How a lift's sets are laid out: set n is `reps + n·repDiff` at `baseWeight + n·weightDiff`. */
export type LiftScheme = {
  baseWeight: number;
  sets: number;
  reps: number;
  repDiff: number;
  weightDiff: number;
};

export type LiftDefinition = LiftScheme & { id: string; name: string };

export type LiftSet = { weight: number; reps: number; done: boolean };

/**
 * One lift as it was performed. The name and scheme are copied in rather than
 * looked up by id, so renaming or deleting the lift later can't rewrite history.
 */
export type LiftEntry = {
  liftId: string;
  name: string;
  scheme: LiftScheme;
  sets: LiftSet[];
  nextBase: number;
};

export const LIFT_WEIGHT_STEP = WEIGHT_STEP;

// ─── Sets ────────────────────────────────────────────────────────────────────

export function roundToPlate(weight: number): number {
  return Math.round(weight / LIFT_WEIGHT_STEP) * LIFT_WEIGHT_STEP;
}

export function generateSets(scheme: LiftScheme): LiftSet[] {
  return Array.from({ length: Math.max(0, Math.floor(scheme.sets)) }, (_, i) => ({
    weight: Math.max(0, roundToPlate(scheme.baseWeight + i * scheme.weightDiff)),
    reps: Math.max(1, Math.round(scheme.reps + i * scheme.repDiff)),
    done: false,
  }));
}

export type SchemeFields = Record<keyof LiftScheme, string>;

/** The text-input form of a scheme, or null when any field wouldn't make a usable lift. */
export function parseScheme(fields: SchemeFields): LiftScheme | null {
  const num = (s: string) => (s.trim() === "" ? NaN : Number(s));
  const scheme: LiftScheme = {
    baseWeight: num(fields.baseWeight),
    sets: num(fields.sets),
    reps: num(fields.reps),
    repDiff: num(fields.repDiff),
    weightDiff: num(fields.weightDiff),
  };
  if (!Object.values(scheme).every(Number.isFinite)) return null;
  if (scheme.baseWeight < 0) return null;
  if (!Number.isInteger(scheme.sets) || scheme.sets < 1) return null;
  if (!Number.isInteger(scheme.reps) || scheme.reps < 1) return null;
  if (!Number.isInteger(scheme.repDiff)) return null;
  return scheme;
}

export function schemeToFields(scheme: LiftScheme): SchemeFields {
  return {
    baseWeight: String(scheme.baseWeight),
    sets: String(scheme.sets),
    reps: String(scheme.reps),
    repDiff: String(scheme.repDiff),
    weightDiff: String(scheme.weightDiff),
  };
}

// ─── Library ─────────────────────────────────────────────────────────────────

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function findLiftByName(library: LiftDefinition[], name: string): LiftDefinition | undefined {
  return library.find((l) => sameName(l.name, name));
}

/**
 * A past session's rows already point at library lifts, so they carry `liftId`.
 * A new session's rows are linked by name instead.
 */
export type LiftDraft = { liftId?: string; name: string; scheme: LiftScheme; sets: LiftSet[]; nextBase: number };

/**
 * Turn the lifts typed into a session into saved entries, linking each name to
 * its library lift. Names the library hasn't seen get a fresh id and come back
 * in `created`; two rows with the same new name share one.
 */
export function commitLifts(
  library: LiftDefinition[],
  drafts: LiftDraft[],
  makeId: () => string,
): { entries: LiftEntry[]; created: LiftDefinition[] } {
  const created: LiftDefinition[] = [];
  const entries = drafts.map((d): LiftEntry => {
    const name = d.name.trim();
    if (d.liftId) return { liftId: d.liftId, name, scheme: d.scheme, sets: d.sets, nextBase: d.nextBase };
    let lift = findLiftByName(library, name) ?? findLiftByName(created, name);
    if (!lift) {
      lift = { id: makeId(), name, ...d.scheme, baseWeight: d.nextBase };
      created.push(lift);
    }
    return { liftId: lift.id, name, scheme: d.scheme, sets: d.sets, nextBase: d.nextBase };
  });
  return { entries, created };
}

// ─── Names ───────────────────────────────────────────────────────────────────

/**
 * The name to show for a logged lift: the library's current one, so a rename
 * reaches old sessions too. The saved copy only shows once the lift is deleted.
 */
export function currentLiftName(entry: LiftEntry, library: LiftDefinition[]): string {
  return library.find((l) => l.id === entry.liftId)?.name ?? entry.name;
}

/** The record as it should be shown, with each lift under its current name. Other sessions pass through. */
export function withCurrentLiftNames(record: SessionRecord, library: LiftDefinition[]): SessionRecord {
  if (record.gymData?.type !== "lifts") return record;
  const lifts = record.gymData.lifts.map((e) => ({ ...e, name: currentLiftName(e, library) }));
  return { ...record, gymData: { ...record.gymData, lifts } };
}

// ─── Formatting ──────────────────────────────────────────────────────────────

const signed = (n: number) => (n < 0 ? `−${-n}` : `+${n}`);

/** "225 · 3×5 −1 rep +10 lb"; the steps are left off when they're zero. */
export function formatScheme(s: LiftScheme): string {
  const parts = [`${s.sets}×${s.reps}`];
  if (s.repDiff !== 0) parts.push(`${signed(s.repDiff)} ${Math.abs(s.repDiff) === 1 ? "rep" : "reps"}`);
  if (s.weightDiff !== 0) parts.push(`${signed(s.weightDiff)} lb`);
  return `${s.baseWeight} · ${parts.join(" ")}`;
}

/** "3×5 @ 225", or "5/4/3 @ 135–155" when the sets differ. Only done sets count; null when none were. */
export function formatLiftSets(entry: LiftEntry): string | null {
  const done = entry.sets.filter((s) => s.done);
  if (done.length === 0) return null;
  const reps = done.map((s) => s.reps);
  const weights = done.map((s) => s.weight);
  const repsText = reps.every((r) => r === reps[0]) ? `${done.length}×${reps[0]}` : reps.join("/");
  const lo = Math.min(...weights);
  const hi = Math.max(...weights);
  return `${repsText} @ ${lo === hi ? lo : `${lo}–${hi}`}`;
}

export function formatLiftEntry(entry: LiftEntry): string {
  return `${entry.name} ${formatLiftSets(entry) ?? "skipped"}`;
}

export function formatLiftsSummary(entries: LiftEntry[]): string {
  return entries.length > 0 ? entries.map(formatLiftEntry).join(" · ") : "—";
}

// ─── Trend ───────────────────────────────────────────────────────────────────

/**
 * The heaviest done set per session for one lift, oldest→newest, newest 20
 * only, in buildTrend's shape so the chart can share its dots. isPR marks the
 * first session to reach the top weight. `setFailed` flags a session where
 * some planned set wasn't done.
 *
 * sessions is newest-first (as returned by getSessions()).
 */
export function buildLiftTrend(sessions: SessionRecord[], liftId: string): TrendPoint[] {
  const points: Omit<TrendPoint, "isPR">[] = [];
  for (const s of sessions) {
    if (s.gymData?.type !== "lifts") continue;
    const sets = s.gymData.lifts.filter((l) => l.liftId === liftId).flatMap((l) => l.sets);
    const done = sets.filter((x) => x.done);
    if (done.length === 0) continue;
    points.push({
      weight: Math.max(...done.map((x) => x.weight)),
      date: new Date(s.startedAt),
      bailed: false,
      setFailed: done.length < sets.length,
      isBeginner: false,
      sessionId: s.id,
    });
    if (points.length === 20) break;
  }
  points.reverse();

  let prIndex = -1;
  points.forEach((p, i) => {
    if (prIndex === -1 || p.weight > points[prIndex].weight) prIndex = i;
  });
  return points.map((p, i) => ({ ...p, isPR: i === prIndex }));
}
