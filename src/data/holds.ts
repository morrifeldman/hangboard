export interface HoldDefinition {
  id: string;
  name: string;
  defaultSet1Weight: number;
  defaultSet2Weight: number;
  set1Reps: number;
  set2Reps: number;
  skipProgression?: boolean;
  // Bodyweight warm-up before the main hangs. Separate from skipProgression,
  // which only means the weight isn't auto-adjusted.
  warmup?: boolean;
  // Per-hold timer overrides (default: global PREP_SECS / HANG_SECS / BREAK_SECS constants)
  prepSecs?: number;
  hangSecs?: number;
  restSecs?: number;
  breakSecs?: number;
  // Set structure overrides (defaults: numSets=2, use set1Reps/set2Reps)
  numSets?: number;
  repsPerSet?: number;
  // Skip the hang phase entirely — show rest timer only (e.g. pull-ups)
  isRestOnly?: boolean;
  // Show a prep countdown between reps (after rest, before next hang)
  prepBetweenReps?: boolean;
  // Per-set weight increment (e.g. 5 → set1=base, set2=base+5, set3=base+10)
  setIncrement?: number;
}

export function isWarmup(hold: HoldDefinition): boolean {
  return hold.warmup === true;
}

/**
 * How much of a bodyweight warm-up was done. Single hangs repeated add up to
 * one count ("×3"); sets of several reps keep their split ("7 + 6").
 */
export function warmupVolume(repsPerSet: readonly number[]): string {
  if (repsPerSet.every((r) => r === 1)) return `×${repsPerSet.length}`;
  if (repsPerSet.length === 1) return `×${repsPerSet[0]}`;
  return repsPerSet.join(" + ");
}

export function plannedReps(hold: HoldDefinition): number[] {
  const numSets = hold.numSets ?? 2;
  return Array.from({ length: numSets }, (_, s) =>
    hold.repsPerSet ?? (s === 0 ? hold.set1Reps : hold.set2Reps),
  );
}

export const HOLDS: HoldDefinition[] = [
  { id: "jug",         name: "Jug",         defaultSet1Weight:  0,    defaultSet2Weight:  0,    set1Reps: 7, set2Reps: 6, skipProgression: true, warmup: true, breakSecs: 120 },
  { id: "large-edge",  name: "Large Edge",  defaultSet1Weight:  5,    defaultSet2Weight:  15,   set1Reps: 7, set2Reps: 6 },
  { id: "mr-shallow",  name: "MR Shallow",  defaultSet1Weight: -35,   defaultSet2Weight: -25,   set1Reps: 7, set2Reps: 6 },
  { id: "small-edge",  name: "Med Edge",    defaultSet1Weight: -20,   defaultSet2Weight: -10,   set1Reps: 7, set2Reps: 6 },
  { id: "imr-shallow", name: "IMR Shallow", defaultSet1Weight:  -10,   defaultSet2Weight:  0,    set1Reps: 7, set2Reps: 6 },
  { id: "wide-pinch",  name: "Wide Pinch",  defaultSet1Weight: -45,   defaultSet2Weight: -35,   set1Reps: 7, set2Reps: 6 },
  { id: "sloper",      name: "Sloper",      defaultSet1Weight: -17.5, defaultSet2Weight: -7.5,  set1Reps: 7, set2Reps: 6 },
  { id: "med-pinch",   name: "Med Pinch",   defaultSet1Weight: -50,   defaultSet2Weight: -40,   set1Reps: 7, set2Reps: 6 },
];
