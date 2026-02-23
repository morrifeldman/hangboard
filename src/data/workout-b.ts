import type { HoldDefinition } from "./holds";

export const HOLDS_B: HoldDefinition[] = [
  // ── Warm-up ─────────────────────────────────────────────────────────────
  {
    id: "b-jug-1",
    name: "Jug",
    defaultSet1Weight: 0, defaultSet2Weight: 0, set1Reps: 1, set2Reps: 1,
    hangSecs: 10, breakSecs: 60, numSets: 1, repsPerSet: 1,
    skipProgression: true,
  },
  {
    id: "b-jug-2",
    name: "Jug",
    defaultSet1Weight: 0, defaultSet2Weight: 0, set1Reps: 1, set2Reps: 1,
    hangSecs: 10, breakSecs: 60, numSets: 1, repsPerSet: 1,
    skipProgression: true,
  },
  {
    id: "b-pullup-1",
    name: "Pull-ups",
    defaultSet1Weight: 0, defaultSet2Weight: 0, set1Reps: 1, set2Reps: 1,
    isRestOnly: true, breakSecs: 60, numSets: 1,
    skipProgression: true,
  },
  {
    id: "b-pullup-2",
    name: "Pull-ups",
    defaultSet1Weight: 0, defaultSet2Weight: 0, set1Reps: 1, set2Reps: 1,
    isRestOnly: true, breakSecs: 60, numSets: 1,
    skipProgression: true,
  },
  {
    id: "b-big-chisel",
    name: "Big Edge — Chisel",
    defaultSet1Weight: 0, defaultSet2Weight: 0, set1Reps: 1, set2Reps: 1,
    hangSecs: 10, breakSecs: 60, numSets: 1, repsPerSet: 1,
    skipProgression: true,
  },
  {
    id: "b-big-hc",
    name: "Big Edge — Half Crimp",
    defaultSet1Weight: 0, defaultSet2Weight: 0, set1Reps: 1, set2Reps: 1,
    hangSecs: 10, breakSecs: 60, numSets: 1, repsPerSet: 1,
    skipProgression: true,
  },
  {
    id: "b-big-open",
    name: "Big Edge — Open",
    defaultSet1Weight: 0, defaultSet2Weight: 0, set1Reps: 1, set2Reps: 1,
    hangSecs: 10, breakSecs: 60, numSets: 1, repsPerSet: 1,
    skipProgression: true,
  },
  {
    id: "b-small-hc-wu",
    name: "Small Edge — Half Crimp",
    defaultSet1Weight: 0, defaultSet2Weight: 0, set1Reps: 1, set2Reps: 1,
    hangSecs: 10, breakSecs: 120, numSets: 1, repsPerSet: 1,
    skipProgression: true,
  },
  // ── Main hangs (Small Edge) ──────────────────────────────────────────────
  {
    id: "b-chisel",
    name: "Chisel",
    defaultSet1Weight: 0, defaultSet2Weight: 0, set1Reps: 1, set2Reps: 1,
    hangSecs: 10, breakSecs: 120, numSets: 3, repsPerSet: 1,
  },
  {
    id: "b-hc",
    name: "Half Crimp",
    defaultSet1Weight: 0, defaultSet2Weight: 0, set1Reps: 1, set2Reps: 1,
    hangSecs: 10, breakSecs: 120, numSets: 3, repsPerSet: 1,
  },
  {
    id: "b-open",
    name: "Open",
    defaultSet1Weight: 0, defaultSet2Weight: 0, set1Reps: 1, set2Reps: 1,
    hangSecs: 10, breakSecs: 120, numSets: 3, repsPerSet: 1,
  },
];
