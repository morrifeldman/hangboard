import { describe, it, expect } from 'vitest';
import { advancePhase, skipSet, skipNextSet, skipNextHold } from '../stateMachine';
import type { SessionState } from '../stateMachine';
import type { HoldDefinition } from '../../data/holds';
import { HOLDS } from '../../data/holds';
import { HOLDS_B } from '../../data/workout-b';

const SET1 = 3;
const SET2 = 2;

// Convenience: a mid-workout state (set 1, rep 0, hold 0, hanging)
function state(overrides: Partial<SessionState>): SessionState {
  return {
    phase: 'hanging',
    holdIndex: 0,
    setNumber: 1,
    repIndex: 0,
    ...overrides,
  };
}

// Minimal hold factory for state machine tests
function hold(overrides: Partial<HoldDefinition> = {}): HoldDefinition {
  return {
    id: 'test', name: 'Test', defaultSet1Weight: 0, defaultSet2Weight: 0,
    set1Reps: SET1, set2Reps: SET2,
    ...overrides,
  };
}

const lastHoldIndex = HOLDS.length - 1;

// ── Workout A (existing 2-set repeater holds) ─────────────────────────────

describe('advancePhase — workout A (numSets=2 default)', () => {
  it('prep → hanging, resets repIndex to 0', () => {
    const s = state({ phase: 'prep', repIndex: 99 });
    const next = advancePhase(s, HOLDS, SET1, SET2);
    expect(next.phase).toBe('hanging');
    expect(next.repIndex).toBe(0);
  });

  it('prep with isRestOnly hold → break (skips hang entirely)', () => {
    const restHolds = [hold({ isRestOnly: true, numSets: 2 }), hold()];
    const s = state({ phase: 'prep', holdIndex: 0, setNumber: 1 });
    const next = advancePhase(s, restHolds, SET1, SET2);
    expect(next.phase).toBe('break');
  });

  it('hanging mid-set → resting (repIndex unchanged)', () => {
    const s = state({ repIndex: 0 }); // not last rep (SET1=3)
    const next = advancePhase(s, HOLDS, SET1, SET2);
    expect(next.phase).toBe('resting');
    expect(next.repIndex).toBe(0);
  });

  it('hanging last rep set1 → break', () => {
    const s = state({ repIndex: SET1 - 1, setNumber: 1 });
    const next = advancePhase(s, HOLDS, SET1, SET2);
    expect(next.phase).toBe('break');
  });

  it('hanging last rep set2, not last hold → break', () => {
    const s = state({ repIndex: SET2 - 1, setNumber: 2, holdIndex: 0 });
    const next = advancePhase(s, HOLDS, SET1, SET2);
    expect(next.phase).toBe('break');
  });

  it('hanging last rep set2, last hold → done', () => {
    const s = state({ repIndex: SET2 - 1, setNumber: 2, holdIndex: lastHoldIndex });
    const next = advancePhase(s, HOLDS, SET1, SET2);
    expect(next.phase).toBe('done');
  });

  it('resting → hanging, increments repIndex', () => {
    const s = state({ phase: 'resting', repIndex: 1 });
    const next = advancePhase(s, HOLDS, SET1, SET2);
    expect(next.phase).toBe('hanging');
    expect(next.repIndex).toBe(2);
  });

  it('break after set1 → prep, setNumber becomes 2, repIndex 0', () => {
    const s = state({ phase: 'break', setNumber: 1, repIndex: 5, holdIndex: 0 });
    const next = advancePhase(s, HOLDS, SET1, SET2);
    expect(next.phase).toBe('prep');
    expect(next.setNumber).toBe(2);
    expect(next.repIndex).toBe(0);
    expect(next.holdIndex).toBe(0);
  });

  it('break after set2 → prep, holdIndex+1, setNumber back to 1', () => {
    const s = state({ phase: 'break', setNumber: 2, holdIndex: 2, repIndex: 5 });
    const next = advancePhase(s, HOLDS, SET1, SET2);
    expect(next.phase).toBe('prep');
    expect(next.holdIndex).toBe(3);
    expect(next.setNumber).toBe(1);
    expect(next.repIndex).toBe(0);
  });

  it('done → idle', () => {
    const s = state({ phase: 'done' });
    const next = advancePhase(s, HOLDS, SET1, SET2);
    expect(next.phase).toBe('idle');
  });

  it('unknown phase returns state unchanged', () => {
    // @ts-expect-error testing runtime guard
    const s = state({ phase: 'unknown' });
    const next = advancePhase(s, HOLDS, SET1, SET2);
    expect(next).toEqual(s);
  });
});

// ── numSets=3 (Max Hang main holds) ──────────────────────────────────────

describe('advancePhase — numSets=3, repsPerSet=1', () => {
  const holds3 = [hold({ numSets: 3, repsPerSet: 1 }), hold({ numSets: 3, repsPerSet: 1 })];

  it('hanging (set1, rep0) → break (only 1 rep per set)', () => {
    const s = state({ setNumber: 1, repIndex: 0 });
    const next = advancePhase(s, holds3, SET1, SET2);
    expect(next.phase).toBe('break');
  });

  it('break after set1 → prep set2', () => {
    const s = state({ phase: 'break', setNumber: 1 });
    const next = advancePhase(s, holds3, SET1, SET2);
    expect(next.phase).toBe('prep');
    expect(next.setNumber).toBe(2);
  });

  it('break after set2 → prep set3', () => {
    const s = state({ phase: 'break', setNumber: 2 });
    const next = advancePhase(s, holds3, SET1, SET2);
    expect(next.phase).toBe('prep');
    expect(next.setNumber).toBe(3);
  });

  it('break after set3, not last hold → prep next hold set1', () => {
    const s = state({ phase: 'break', setNumber: 3, holdIndex: 0 });
    const next = advancePhase(s, holds3, SET1, SET2);
    expect(next.phase).toBe('prep');
    expect(next.holdIndex).toBe(1);
    expect(next.setNumber).toBe(1);
  });

  it('break after set3, last hold → done', () => {
    const s = state({ phase: 'break', setNumber: 3, holdIndex: 1 });
    const next = advancePhase(s, holds3, SET1, SET2);
    expect(next.phase).toBe('done');
  });
});

// ── numSets=1 (warmup single hangs) ──────────────────────────────────────

describe('advancePhase — numSets=1, repsPerSet=1', () => {
  const holds1 = [hold({ numSets: 1, repsPerSet: 1 }), hold({ numSets: 1, repsPerSet: 1 })];

  it('hanging → break (last set, not last rep check)', () => {
    const s = state({ setNumber: 1, repIndex: 0 });
    const next = advancePhase(s, holds1, SET1, SET2);
    expect(next.phase).toBe('break');
  });

  it('break (set1=last set) → prep next hold', () => {
    const s = state({ phase: 'break', setNumber: 1, holdIndex: 0 });
    const next = advancePhase(s, holds1, SET1, SET2);
    expect(next.phase).toBe('prep');
    expect(next.holdIndex).toBe(1);
    expect(next.setNumber).toBe(1);
  });

  it('break (set1=last set) on last hold → done', () => {
    const s = state({ phase: 'break', setNumber: 1, holdIndex: 1 });
    const next = advancePhase(s, holds1, SET1, SET2);
    expect(next.phase).toBe('done');
  });
});

// ── workout B smoke test (full HOLDS_B array) ─────────────────────────────

describe('advancePhase — HOLDS_B smoke tests', () => {
  it('first jug hang completes → break', () => {
    const s = state({ setNumber: 1, repIndex: 0, holdIndex: 0 });
    const next = advancePhase(s, HOLDS_B, 1, 1);
    expect(next.phase).toBe('break');
  });

  it('isRestOnly (Pull-ups) prep → break (skips hang)', () => {
    // holdIndex 1 = b-pullup (isRestOnly, numSets:2)
    const s = state({ phase: 'prep', holdIndex: 1, setNumber: 1 });
    const next = advancePhase(s, HOLDS_B, 1, 1);
    expect(next.phase).toBe('break');
  });

  it('Chisel set2 break → prep set3', () => {
    // holdIndex 6 = b-chisel (numSets:3) after merging jug/pullup pairs
    const s = state({ phase: 'break', setNumber: 2, holdIndex: 6 });
    const next = advancePhase(s, HOLDS_B, 1, 1);
    expect(next.phase).toBe('prep');
    expect(next.setNumber).toBe(3);
  });

  it('Open set3 (last hold, last set) → done', () => {
    // holdIndex 8 = b-open (numSets:3) after merging jug/pullup pairs
    const s = state({ phase: 'break', setNumber: 3, holdIndex: 8 });
    const next = advancePhase(s, HOLDS_B, 1, 1);
    expect(next.phase).toBe('done');
  });
});

// ── skipSet ───────────────────────────────────────────────────────────────

describe('skipSet', () => {
  it('mid-workout set1 → break', () => {
    const s = state({ setNumber: 1, holdIndex: 0 });
    expect(skipSet(s, HOLDS).phase).toBe('break');
  });

  it('set2 not last hold → break', () => {
    const s = state({ setNumber: 2, holdIndex: 0 });
    expect(skipSet(s, HOLDS).phase).toBe('break');
  });

  it('set2 last hold → done', () => {
    const s = state({ setNumber: 2, holdIndex: lastHoldIndex });
    expect(skipSet(s, HOLDS).phase).toBe('done');
  });

  it('set1 last hold → break (set2 still remains)', () => {
    const s = state({ setNumber: 1, holdIndex: lastHoldIndex });
    expect(skipSet(s, HOLDS).phase).toBe('break');
  });

  it('numSets=3: set3 last hold → done', () => {
    const holds3 = [hold({ numSets: 3 })];
    const s = state({ setNumber: 3, holdIndex: 0 });
    expect(skipSet(s, holds3).phase).toBe('done');
  });

  it('numSets=3: set2 not last hold → break', () => {
    const holds3 = [hold({ numSets: 3 }), hold({ numSets: 3 })];
    const s = state({ setNumber: 2, holdIndex: 0 });
    expect(skipSet(s, holds3).phase).toBe('break');
  });
});

// ── skipNextSet ───────────────────────────────────────────────────────────

describe('skipNextSet', () => {
  it('not last hold → break, setNumber=numSets', () => {
    const s = state({ holdIndex: 0 });
    const next = skipNextSet(s, HOLDS);
    expect(next.phase).toBe('break');
    expect(next.setNumber).toBe(2); // numSets=2 default
  });

  it('last hold → done', () => {
    const s = state({ holdIndex: lastHoldIndex });
    expect(skipNextSet(s, HOLDS).phase).toBe('done');
  });
});

// ── skipNextHold ──────────────────────────────────────────────────────────

describe('skipNextHold', () => {
  it('not penultimate hold → break, holdIndex+1, setNumber=2', () => {
    const s = state({ holdIndex: 0 });
    const next = skipNextHold(s, HOLDS);
    expect(next.phase).toBe('break');
    expect(next.holdIndex).toBe(1);
    expect(next.setNumber).toBe(2);
  });

  it('penultimate hold (nextHold = last) → done', () => {
    const s = state({ holdIndex: lastHoldIndex - 1 });
    expect(skipNextHold(s, HOLDS).phase).toBe('done');
  });
});

// ── immutability ──────────────────────────────────────────────────────────

describe('immutability', () => {
  it('advancePhase does not mutate input', () => {
    const s = state({ phase: 'prep' });
    const original = { ...s };
    advancePhase(s, HOLDS, SET1, SET2);
    expect(s).toEqual(original);
  });

  it('skipSet does not mutate input', () => {
    const s = state({ setNumber: 1, holdIndex: 0 });
    const original = { ...s };
    skipSet(s, HOLDS);
    expect(s).toEqual(original);
  });
});
