import type { HoldDefinition } from "../data/holds";
import type { SessionState, WorkoutPhase } from "./stateMachine";
import { PREP_SECS, HANG_SECS, REST_SECS, BREAK_SECS } from "../data/workout";

function prepFor(h: HoldDefinition)  { return h.prepSecs  ?? PREP_SECS; }
function hangFor(h: HoldDefinition)  { return h.hangSecs  ?? HANG_SECS; }
function restFor(h: HoldDefinition)  { return h.restSecs  ?? REST_SECS; }
function breakFor(h: HoldDefinition) { return h.breakSecs ?? BREAK_SECS; }

function repsFor(h: HoldDefinition, setNum: number, set1Reps: number, set2Reps: number): number {
  return h.repsPerSet ?? (setNum === 1 ? set1Reps : set2Reps);
}

type PhaseStep = { phase: WorkoutPhase; repIndex: number; secs: number };

function setPhaseSequence(h: HoldDefinition, setNum: number, set1Reps: number, set2Reps: number): PhaseStep[] {
  const out: PhaseStep[] = [];
  out.push({ phase: "prep", repIndex: 0, secs: prepFor(h) });
  if (h.isRestOnly) {
    out.push({ phase: "break", repIndex: 0, secs: breakFor(h) });
    return out;
  }
  const reps = repsFor(h, setNum, set1Reps, set2Reps);
  for (let r = 0; r < reps; r++) {
    out.push({ phase: "hanging", repIndex: r, secs: hangFor(h) });
    if (r < reps - 1) {
      out.push({ phase: "resting", repIndex: r, secs: restFor(h) });
      if (h.prepBetweenReps) out.push({ phase: "prep", repIndex: r + 1, secs: prepFor(h) });
    }
  }
  out.push({ phase: "break", repIndex: Math.max(0, reps - 1), secs: breakFor(h) });
  return out;
}

function setDurationSecs(h: HoldDefinition, setNum: number, set1Reps: number, set2Reps: number): number {
  return setPhaseSequence(h, setNum, set1Reps, set2Reps).reduce((acc, s) => acc + s.secs, 0);
}

export function totalWorkoutSecs(
  holds: readonly HoldDefinition[],
  set1Reps: number,
  set2Reps: number,
): number {
  let total = 0;
  for (const h of holds) {
    const numSets = h.numSets ?? 2;
    for (let s = 1; s <= numSets; s++) total += setDurationSecs(h, s, set1Reps, set2Reps);
  }
  return total;
}

export function currentPhaseFullSecs(state: SessionState, holds: readonly HoldDefinition[]): number {
  const h = holds[state.holdIndex];
  if (!h) return 0;
  switch (state.phase) {
    case "prep":    return prepFor(h);
    case "hanging": return hangFor(h);
    case "resting": return restFor(h);
    case "break":   return breakFor(h);
    default:        return 0;
  }
}

function findPhaseIndex(seq: PhaseStep[], phase: WorkoutPhase, repIndex: number): number {
  let fallback = -1;
  for (let i = 0; i < seq.length; i++) {
    if (seq[i].phase !== phase) continue;
    if (seq[i].repIndex === repIndex) return i;
    if (fallback < 0) fallback = i;
  }
  return fallback;
}

function remainingInCurrentSet(state: SessionState, h: HoldDefinition, set1Reps: number, set2Reps: number): number {
  const seq = setPhaseSequence(h, state.setNumber, set1Reps, set2Reps);
  const idx = findPhaseIndex(seq, state.phase, state.repIndex);
  if (idx < 0) return 0;
  let rem = 0;
  for (let i = idx + 1; i < seq.length; i++) rem += seq[i].secs;
  return rem;
}

export function remainingWorkoutSecs(
  state: SessionState,
  holds: readonly HoldDefinition[],
  set1Reps: number,
  set2Reps: number,
  currentPhaseRemaining: number,
): number {
  if (state.phase === "idle" || state.phase === "done") return 0;
  let rem = Math.max(0, currentPhaseRemaining);

  const h = holds[state.holdIndex];
  if (!h) return rem;

  rem += remainingInCurrentSet(state, h, set1Reps, set2Reps);

  const numSets = h.numSets ?? 2;
  for (let s = state.setNumber + 1; s <= numSets; s++) {
    rem += setDurationSecs(h, s, set1Reps, set2Reps);
  }

  for (let i = state.holdIndex + 1; i < holds.length; i++) {
    const hh = holds[i];
    const ns = hh.numSets ?? 2;
    for (let s = 1; s <= ns; s++) rem += setDurationSecs(hh, s, set1Reps, set2Reps);
  }
  return rem;
}
