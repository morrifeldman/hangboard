import type { HoldDefinition } from '../data/holds';

export type WorkoutPhase = 'idle' | 'prep' | 'hanging' | 'resting' | 'break' | 'done';

export type SessionState = {
  phase: WorkoutPhase;
  holdIndex: number;
  setNumber: number;
  repIndex: number;
};

export const INITIAL_STATE: SessionState = {
  phase: 'prep', holdIndex: 0, setNumber: 1, repIndex: 0,
};

export function advancePhase(
  s: SessionState,
  holds: readonly HoldDefinition[],
  set1Reps: number,
  set2Reps: number,
): SessionState {
  const hold = holds[s.holdIndex];
  const numSets = hold.numSets ?? 2;
  const repsThisSet = hold.repsPerSet ?? (s.setNumber === 1 ? set1Reps : set2Reps);
  const isLastRep = s.repIndex >= repsThisSet - 1;
  const isLastSet = s.setNumber >= numSets;
  const isLastHold = s.holdIndex >= holds.length - 1;

  switch (s.phase) {
    case 'prep':
      return { ...s, phase: 'hanging', repIndex: 0 };
    case 'hanging':
      if (!isLastRep) return { ...s, phase: 'resting' };
      if (!isLastSet) return { ...s, phase: 'break' };
      if (isLastHold) return { ...s, phase: 'done' };
      return { ...s, phase: 'break' };
    case 'resting':
      return { ...s, phase: 'hanging', repIndex: s.repIndex + 1 };
    case 'break':
      if (!isLastSet)
        return { ...s, phase: 'prep', setNumber: s.setNumber + 1, repIndex: 0 };
      if (isLastHold) return { ...s, phase: 'done' };
      return { ...s, phase: 'prep', holdIndex: s.holdIndex + 1, setNumber: 1, repIndex: 0 };
    case 'done':
      return { ...s, phase: 'idle' };
    default:
      return s;
  }
}

export function skipSet(s: SessionState, holds: readonly HoldDefinition[]): SessionState {
  const hold = holds[s.holdIndex];
  const numSets = hold.numSets ?? 2;
  const isLastSet = s.setNumber >= numSets;
  const isLastHold = s.holdIndex >= holds.length - 1;
  if (isLastSet && isLastHold) return { ...s, phase: 'done' };
  return { ...s, phase: 'break' };
}

export function skipNextSet(s: SessionState, holds: readonly HoldDefinition[]): SessionState {
  const hold = holds[s.holdIndex];
  const numSets = hold.numSets ?? 2;
  const isLastHold = s.holdIndex >= holds.length - 1;
  if (isLastHold) return { ...s, phase: 'done' };
  // Jump setNumber to numSets so the break handler advances to the next hold
  return { ...s, setNumber: numSets, phase: 'break' };
}

export function skipNextHold(s: SessionState, holds: readonly HoldDefinition[]): SessionState {
  const nextHoldIndex = s.holdIndex + 1;
  if (nextHoldIndex >= holds.length - 1) return { ...s, phase: 'done' };
  return { ...s, holdIndex: nextHoldIndex, setNumber: 2, phase: 'break' };
}
