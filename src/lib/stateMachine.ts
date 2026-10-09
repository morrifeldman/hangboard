import type { HoldDefinition } from '../data/holds';
import { numSetsOf, repsFor } from '../data/holds';

export type WorkoutPhase = 'idle' | 'prep' | 'hanging' | 'resting' | 'break' | 'done';

export type SessionState = {
  phase: WorkoutPhase;
  holdIndex: number;
  setNumber: number;
  repIndex: number;
  /** Upcoming sets the user chose to skip, as `setKey` strings. */
  skipped?: readonly string[];
  /** Sets actually finished: the last rep was hung, or a rest-only set's break ran. */
  completed?: readonly string[];
};

export type SetRef = { holdIndex: number; setNumber: number };

export function setKey(holdIndex: number, setNumber: number): string {
  return `${holdIndex}:${setNumber}`;
}

export const INITIAL_STATE: SessionState = {
  phase: 'prep', holdIndex: 0, setNumber: 1, repIndex: 0, skipped: [], completed: [],
};

/**
 * The next set after the current one that hasn't been skipped, or null when
 * the current set is the last one left. Every "what comes next" decision —
 * the state machine, the time estimate and the break screen — goes through
 * this, so they can't disagree.
 */
export function upcomingSet(s: SessionState, holds: readonly HoldDefinition[]): SetRef | null {
  const skipped = s.skipped ?? [];
  let h = s.holdIndex;
  let n = s.setNumber + 1;
  while (h < holds.length) {
    if (n > numSetsOf(holds[h])) {
      h++;
      n = 1;
      continue;
    }
    if (!skipped.includes(setKey(h, n))) return { holdIndex: h, setNumber: n };
    n++;
  }
  return null;
}

function markCompleted(s: SessionState): readonly string[] {
  const done = s.completed ?? [];
  const key = setKey(s.holdIndex, s.setNumber);
  return done.includes(key) ? done : [...done, key];
}

/** Leave the current set: go to its break, or finish if nothing is left. */
function endSet(s: SessionState, holds: readonly HoldDefinition[]): SessionState {
  return upcomingSet(s, holds) ? { ...s, phase: 'break' } : { ...s, phase: 'done' };
}

export function advancePhase(s: SessionState, holds: readonly HoldDefinition[]): SessionState {
  const hold = holds[s.holdIndex];
  const isLastRep = s.repIndex >= repsFor(hold, s.setNumber) - 1;

  switch (s.phase) {
    case 'prep':
      if (hold.isRestOnly) return { ...s, phase: 'break' };
      return { ...s, phase: 'hanging' };
    case 'hanging':
      if (!isLastRep) return { ...s, phase: 'resting' };
      // The final hang of the workout skips the pointless trailing break.
      return endSet({ ...s, completed: markCompleted(s) }, holds);
    case 'resting':
      if (hold.prepBetweenReps) return { ...s, phase: 'prep', repIndex: s.repIndex + 1 };
      return { ...s, phase: 'hanging', repIndex: s.repIndex + 1 };
    case 'break': {
      // For a rest-only hold (e.g. pull-ups) the break is the work.
      const completed = hold.isRestOnly ? markCompleted(s) : s.completed;
      const next = upcomingSet(s, holds);
      if (!next) return { ...s, completed, phase: 'done' };
      return { ...s, completed, phase: 'prep', ...next, repIndex: 0 };
    }
    case 'done':
      return { ...s, phase: 'idle' };
    default:
      return s;
  }
}

/** Abandon the set in progress (it isn't marked completed). */
export function skipSet(s: SessionState, holds: readonly HoldDefinition[]): SessionState {
  return endSet(s, holds);
}

function skipUpcoming(
  s: SessionState,
  holds: readonly HoldDefinition[],
  keysFor: (next: SetRef) => string[],
): SessionState {
  const next = upcomingSet(s, holds);
  if (!next) return s;
  const skipped = [...(s.skipped ?? []), ...keysFor(next)];
  const out = { ...s, skipped };
  // Stay in the current break (its clock keeps running) unless nothing is left.
  return upcomingSet(out, holds) ? out : { ...out, phase: 'done' };
}

/** From a break: skip just the set that was coming up next. */
export function skipNextSet(s: SessionState, holds: readonly HoldDefinition[]): SessionState {
  return skipUpcoming(s, holds, (next) => [setKey(next.holdIndex, next.setNumber)]);
}

/** From a break: skip every remaining set of the hold that was coming up next. */
export function skipNextHold(s: SessionState, holds: readonly HoldDefinition[]): SessionState {
  return skipUpcoming(s, holds, (next) => {
    const keys: string[] = [];
    for (let n = next.setNumber; n <= numSetsOf(holds[next.holdIndex]); n++) {
      keys.push(setKey(next.holdIndex, n));
    }
    return keys;
  });
}
