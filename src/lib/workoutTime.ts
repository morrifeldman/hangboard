import type { HoldDefinition } from "../data/holds";
import { repsFor } from "../data/holds";
import { INITIAL_STATE, upcomingSet } from "./stateMachine";
import type { SessionState, WorkoutPhase } from "./stateMachine";
import { PREP_SECS, HANG_SECS, REST_SECS, BREAK_SECS } from "../data/workout";

function prepFor(h: HoldDefinition)  { return h.prepSecs  ?? PREP_SECS; }
function hangFor(h: HoldDefinition)  { return h.hangSecs  ?? HANG_SECS; }
function restFor(h: HoldDefinition)  { return h.restSecs  ?? REST_SECS; }
function breakFor(h: HoldDefinition) { return h.breakSecs ?? BREAK_SECS; }

type PhaseStep = { phase: WorkoutPhase; repIndex: number; secs: number };

// The phases of one set, in the order the state machine walks them. `isFinalSet`
// drops the break that normally follows: the state machine sends the last set
// left straight to `done` (rest-only holds keep their break — there the break
// IS the work).
function setPhaseSequence(h: HoldDefinition, setNum: number, isFinalSet: boolean): PhaseStep[] {
  const out: PhaseStep[] = [];
  out.push({ phase: "prep", repIndex: 0, secs: prepFor(h) });
  if (h.isRestOnly) {
    out.push({ phase: "break", repIndex: 0, secs: breakFor(h) });
    return out;
  }
  const reps = repsFor(h, setNum);
  for (let r = 0; r < reps; r++) {
    out.push({ phase: "hanging", repIndex: r, secs: hangFor(h) });
    if (r < reps - 1) {
      out.push({ phase: "resting", repIndex: r, secs: restFor(h) });
      if (h.prepBetweenReps) out.push({ phase: "prep", repIndex: r + 1, secs: prepFor(h) });
    }
  }
  if (!isFinalSet) out.push({ phase: "break", repIndex: Math.max(0, reps - 1), secs: breakFor(h) });
  return out;
}

function sumSecs(steps: PhaseStep[]): number {
  return steps.reduce((acc, s) => acc + s.secs, 0);
}

/** Full length of the current phase, in seconds (0 for idle/done). */
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

/**
 * Seconds left in the workout: what's left of the current phase, the rest of
 * the current set, then every set still to come (skipped sets excluded).
 */
export function remainingWorkoutSecs(
  state: SessionState,
  holds: readonly HoldDefinition[],
  currentPhaseRemaining: number,
): number {
  if (state.phase === "idle" || state.phase === "done") return 0;
  const h = holds[state.holdIndex];
  if (!h) return Math.max(0, currentPhaseRemaining);

  let rem = Math.max(0, currentPhaseRemaining);
  let next = upcomingSet(state, holds);
  const seq = setPhaseSequence(h, state.setNumber, next === null);
  const idx = findPhaseIndex(seq, state.phase, state.repIndex);
  if (idx >= 0) rem += sumSecs(seq.slice(idx + 1));

  let cursor: SessionState = state;
  while (next) {
    cursor = { ...cursor, ...next };
    const after = upcomingSet(cursor, holds);
    rem += sumSecs(setPhaseSequence(holds[next.holdIndex], next.setNumber, after === null));
    next = after;
  }
  return rem;
}

export function totalWorkoutSecs(holds: readonly HoldDefinition[]): number {
  if (holds.length === 0) return 0;
  const start = { ...INITIAL_STATE, skipped: [] };
  return remainingWorkoutSecs(start, holds, currentPhaseFullSecs(start, holds));
}

// Wall-clock time the workout is due to finish, e.g. "5:42 PM". `nowMs` plus
// the seconds left; those two move in lockstep, so the answer holds steady
// between ticks and only shifts when a skip or a pause changes what's left.
export function finishClockTime(nowMs: number, remainingSecs: number): string {
  const d = new Date(nowMs + Math.max(0, remainingSecs) * 1000);
  const h24 = d.getHours();
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m} ${h24 < 12 ? "AM" : "PM"}`;
}
