import type { SessionRecord, SessionHoldRecord } from "./history";

// Pure helpers for the "weight going up / down next time" cues shown on the
// History cards, the session edit view, and the workout setup overview.

export type WeightDirection = "up" | "down" | "mixed";

/**
 * Direction of the next-session target relative to the weights actually used
 * in this session, per hold. Returns null when the hold has no captured `next`
 * (older/imported sessions) or when nothing changed.
 */
export function holdNextDirection(hold: SessionHoldRecord): WeightDirection | null {
  const next = hold.next;
  if (!next) return null;
  const deltas: number[] = [next.set1 - hold.set1.weight];
  if (hold.set2 && next.set2 != null) deltas.push(next.set2 - hold.set2.weight);
  if (hold.set3 && next.set3 != null) deltas.push(next.set3 - hold.set3.weight);
  const up = deltas.some((d) => d > 0);
  const down = deltas.some((d) => d < 0);
  if (up && down) return "mixed";
  if (up) return "up";
  if (down) return "down";
  return null;
}

/**
 * Per-session rollup for the History card badge: how many holds are queued to
 * go up / down next time. A mixed hold counts toward both. Returns null when
 * no hold carries a `next` target (nothing to say — don't render a badge).
 */
export function sessionNextSummary(
  record: SessionRecord,
): { up: number; down: number } | null {
  let any = false;
  let up = 0;
  let down = 0;
  for (const hold of record.holds) {
    if (!hold.next) continue;
    any = true;
    const dir = holdNextDirection(hold);
    if (dir === "up") up++;
    else if (dir === "down") down++;
    else if (dir === "mixed") {
      up++;
      down++;
    }
  }
  return any ? { up, down } : null;
}

/**
 * Δ between a persisted next-session target and the weight recorded for the
 * same hold/set in the last saved session — the setup overview's "advancing
 * vs last workout" cue. Returns null when there's no baseline to compare to.
 */
export function overviewDelta(
  target: number,
  lastHold: SessionHoldRecord | undefined,
  set: 1 | 2,
): number | null {
  if (!lastHold) return null;
  const baseline = set === 1 ? lastHold.set1.weight : lastHold.set2?.weight;
  if (baseline === undefined) return null;
  return target - baseline;
}
