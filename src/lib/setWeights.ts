import type { HoldDefinition } from "../data/holds";

export type StoredSetWeights = { set1: number; set2: number };
export type SetOverrides = { set1: number | null; set2: number | null; set3?: number | null };

export function overrideKeyFor(setNum: number): "set1" | "set2" | "set3" {
  return setNum <= 1 ? "set1" : setNum === 2 ? "set2" : "set3";
}

/**
 * The planned weight for a set, from a stored {set1,set2} pair (or hold defaults).
 * For holds with a `setIncrement` (max hang), sets above 1 are set1 + N·increment.
 */
export function plannedWeight(
  hold: HoldDefinition | undefined,
  stored: StoredSetWeights | undefined,
  setNum: number,
): number {
  const set1 = stored?.set1 ?? hold?.defaultSet1Weight ?? 0;
  if (setNum <= 1) return set1;
  if (hold?.setIncrement) return set1 + (setNum - 1) * hold.setIncrement;
  return stored?.set2 ?? hold?.defaultSet2Weight ?? 0;
}

/**
 * The weight for a set in the workout in progress. A set the user overrode keeps its override;
 * any other set keeps its planned gap to the set before it, so adjusting one set carries forward.
 */
export function sessionSetWeight(
  hold: HoldDefinition | undefined,
  stored: StoredSetWeights | undefined,
  overrides: SetOverrides | undefined,
  setNum: number,
): number {
  const override = overrides?.[overrideKeyFor(setNum)] ?? null;
  if (override !== null) return override;
  if (setNum <= 1) return plannedWeight(hold, stored, 1);
  const gap = plannedWeight(hold, stored, setNum) - plannedWeight(hold, stored, setNum - 1);
  return sessionSetWeight(hold, stored, overrides, setNum - 1) + gap;
}
