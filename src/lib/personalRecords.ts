import type { SessionHoldRecord, SessionRecord } from "./history";
import { HOLDS, isWarmup } from "../data/holds";
import { HOLDS_B } from "../data/workout-b";
import { isHangboardSession } from "./sessionKind";

const WARMUP_IDS = new Set([...HOLDS, ...HOLDS_B].filter(isWarmup).map((h) => h.id));


/** Heaviest weight actually completed on a hold; a failed set doesn't count toward a PR. */
export function bestCompletedWeight(hold: SessionHoldRecord): number | null {
  const weights = [hold.set1, hold.set2, hold.set3]
    .filter((s) => s != null && s.completed)
    .map((s) => s!.weight);
  return weights.length ? Math.max(...weights) : null;
}

/** Best completed weight per hold across hangboard sessions that started before `before`. */
export function bestsBefore(
  sessions: SessionRecord[],
  before: number,
  excludeId?: string,
): Map<string, number> {
  const bests = new Map<string, number>();
  for (const s of sessions) {
    if (!isHangboardSession(s) || s.id === excludeId || s.startedAt >= before) continue;
    for (const h of s.holds) {
      const w = bestCompletedWeight(h);
      if (w !== null && w > (bests.get(h.holdId) ?? -Infinity)) bests.set(h.holdId, w);
    }
  }
  return bests;
}

/**
 * A PR is a completed weight heavier than anything done on that hold before.
 * The first time on a hold sets the baseline rather than counting, otherwise
 * every hold of the first session would light up.
 */
export function isPR(holdId: string, weight: number | null, priorBests: Map<string, number>): boolean {
  if (weight === null || WARMUP_IDS.has(holdId)) return false;
  const prior = priorBests.get(holdId);
  return prior !== undefined && weight > prior;
}

/** Session id → ids of the holds that set a PR in it. */
export function sessionPRs(sessions: SessionRecord[]): Map<string, string[]> {
  const chronological = sessions.filter(isHangboardSession).sort((a, b) => a.startedAt - b.startedAt);
  const bests = new Map<string, number>();
  const out = new Map<string, string[]>();
  for (const s of chronological) {
    const prs: string[] = [];
    const sessionBests: [string, number][] = [];
    for (const h of s.holds) {
      const w = bestCompletedWeight(h);
      if (w === null) continue;
      if (isPR(h.holdId, w, bests)) prs.push(h.holdId);
      sessionBests.push([h.holdId, w]);
    }
    for (const [id, w] of sessionBests) {
      if (w > (bests.get(id) ?? -Infinity)) bests.set(id, w);
    }
    if (prs.length) out.set(s.id, prs);
  }
  return out;
}
