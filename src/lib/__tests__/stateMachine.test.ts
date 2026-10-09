import { describe, it, expect } from 'vitest';
import { advancePhase, setKey, skipSet, skipNextSet, skipNextHold, upcomingSet } from '../stateMachine';
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
  it('prep → hanging, preserves repIndex', () => {
    const s = state({ phase: 'prep', repIndex: 0 });
    const next = advancePhase(s, HOLDS);
    expect(next.phase).toBe('hanging');
    expect(next.repIndex).toBe(0);
  });

  it('prepBetweenReps: resting → prep with incremented repIndex', () => {
    const preppedHolds = [hold({ prepBetweenReps: true, repsPerSet: 3 }), hold()];
    const s = state({ phase: 'resting', repIndex: 0 });
    const next = advancePhase(s, preppedHolds);
    expect(next.phase).toBe('prep');
    expect(next.repIndex).toBe(1);
  });

  it('prepBetweenReps: mid-set prep → hanging, repIndex unchanged', () => {
    const preppedHolds = [hold({ prepBetweenReps: true, repsPerSet: 3 }), hold()];
    const s = state({ phase: 'prep', repIndex: 1 });
    const next = advancePhase(s, preppedHolds);
    expect(next.phase).toBe('hanging');
    expect(next.repIndex).toBe(1);
  });

  it('prep with isRestOnly hold → break (skips hang entirely)', () => {
    const restHolds = [hold({ isRestOnly: true, numSets: 2 }), hold()];
    const s = state({ phase: 'prep', holdIndex: 0, setNumber: 1 });
    const next = advancePhase(s, restHolds);
    expect(next.phase).toBe('break');
  });

  it('hanging mid-set → resting (repIndex unchanged)', () => {
    const s = state({ repIndex: 0 }); // not last rep (SET1=3)
    const next = advancePhase(s, HOLDS);
    expect(next.phase).toBe('resting');
    expect(next.repIndex).toBe(0);
  });

  it('hanging last rep set1 → break', () => {
    const s = state({ repIndex: HOLDS[0].set1Reps - 1, setNumber: 1 });
    const next = advancePhase(s, HOLDS);
    expect(next.phase).toBe('break');
  });

  it('hanging last rep set2, not last hold → break', () => {
    const s = state({ repIndex: HOLDS[0].set2Reps - 1, setNumber: 2, holdIndex: 0 });
    const next = advancePhase(s, HOLDS);
    expect(next.phase).toBe('break');
  });

  it('hanging last rep set2, last hold → done (skips pointless final break)', () => {
    const s = state({ repIndex: HOLDS[lastHoldIndex].set2Reps - 1, setNumber: 2, holdIndex: lastHoldIndex });
    const next = advancePhase(s, HOLDS);
    expect(next.phase).toBe('done');
  });

  it('resting → hanging, increments repIndex', () => {
    const s = state({ phase: 'resting', repIndex: 1 });
    const next = advancePhase(s, HOLDS);
    expect(next.phase).toBe('hanging');
    expect(next.repIndex).toBe(2);
  });

  it('break after set1 → prep, setNumber becomes 2, repIndex 0', () => {
    const s = state({ phase: 'break', setNumber: 1, repIndex: 5, holdIndex: 0 });
    const next = advancePhase(s, HOLDS);
    expect(next.phase).toBe('prep');
    expect(next.setNumber).toBe(2);
    expect(next.repIndex).toBe(0);
    expect(next.holdIndex).toBe(0);
  });

  it('break after set2 → prep, holdIndex+1, setNumber back to 1', () => {
    const s = state({ phase: 'break', setNumber: 2, holdIndex: 2, repIndex: 5 });
    const next = advancePhase(s, HOLDS);
    expect(next.phase).toBe('prep');
    expect(next.holdIndex).toBe(3);
    expect(next.setNumber).toBe(1);
    expect(next.repIndex).toBe(0);
  });

  it('done → idle', () => {
    const s = state({ phase: 'done' });
    const next = advancePhase(s, HOLDS);
    expect(next.phase).toBe('idle');
  });

  it('unknown phase returns state unchanged', () => {
    // @ts-expect-error testing runtime guard
    const s = state({ phase: 'unknown' });
    const next = advancePhase(s, HOLDS);
    expect(next).toEqual(s);
  });
});

// ── numSets=3 (Max Hang main holds) ──────────────────────────────────────

describe('advancePhase — numSets=3, repsPerSet=1', () => {
  const holds3 = [hold({ numSets: 3, repsPerSet: 1 }), hold({ numSets: 3, repsPerSet: 1 })];

  it('hanging (set1, rep0) → break (only 1 rep per set)', () => {
    const s = state({ setNumber: 1, repIndex: 0 });
    const next = advancePhase(s, holds3);
    expect(next.phase).toBe('break');
  });

  it('break after set1 → prep set2', () => {
    const s = state({ phase: 'break', setNumber: 1 });
    const next = advancePhase(s, holds3);
    expect(next.phase).toBe('prep');
    expect(next.setNumber).toBe(2);
  });

  it('break after set2 → prep set3', () => {
    const s = state({ phase: 'break', setNumber: 2 });
    const next = advancePhase(s, holds3);
    expect(next.phase).toBe('prep');
    expect(next.setNumber).toBe(3);
  });

  it('break after set3, not last hold → prep next hold set1', () => {
    const s = state({ phase: 'break', setNumber: 3, holdIndex: 0 });
    const next = advancePhase(s, holds3);
    expect(next.phase).toBe('prep');
    expect(next.holdIndex).toBe(1);
    expect(next.setNumber).toBe(1);
  });

  it('break after set3, last hold → done', () => {
    const s = state({ phase: 'break', setNumber: 3, holdIndex: 1 });
    const next = advancePhase(s, holds3);
    expect(next.phase).toBe('done');
  });

  it('hanging set3 (last set, last hold) → done (skips final break)', () => {
    const s = state({ phase: 'hanging', setNumber: 3, repIndex: 0, holdIndex: 1 });
    const next = advancePhase(s, holds3);
    expect(next.phase).toBe('done');
  });
});

// ── numSets=1 (warmup single hangs) ──────────────────────────────────────

describe('advancePhase — numSets=1, repsPerSet=1', () => {
  const holds1 = [hold({ numSets: 1, repsPerSet: 1 }), hold({ numSets: 1, repsPerSet: 1 })];

  it('hanging → break (last set, not last rep check)', () => {
    const s = state({ setNumber: 1, repIndex: 0 });
    const next = advancePhase(s, holds1);
    expect(next.phase).toBe('break');
  });

  it('break (set1=last set) → prep next hold', () => {
    const s = state({ phase: 'break', setNumber: 1, holdIndex: 0 });
    const next = advancePhase(s, holds1);
    expect(next.phase).toBe('prep');
    expect(next.holdIndex).toBe(1);
    expect(next.setNumber).toBe(1);
  });

  it('break (set1=last set) on last hold → done', () => {
    const s = state({ phase: 'break', setNumber: 1, holdIndex: 1 });
    const next = advancePhase(s, holds1);
    expect(next.phase).toBe('done');
  });
});

// ── workout B smoke test (full HOLDS_B array) ─────────────────────────────

describe('advancePhase — HOLDS_B smoke tests', () => {
  const at = (id: string) => HOLDS_B.findIndex((h) => h.id === id);

  it('first jug hang completes → resting (3 reps)', () => {
    const s = state({ setNumber: 1, repIndex: 0, holdIndex: 0 });
    const next = advancePhase(s, HOLDS_B);
    expect(next.phase).toBe('resting');
  });

  it('isRestOnly (Pull-ups) prep → break (skips hang)', () => {
    const s = state({ phase: 'prep', holdIndex: at('b-pullup'), setNumber: 1 });
    const next = advancePhase(s, HOLDS_B);
    expect(next.phase).toBe('break');
  });

  it('Chisel set2 break → prep set3', () => {
    const s = state({ phase: 'break', setNumber: 2, holdIndex: at('b-chisel') });
    const next = advancePhase(s, HOLDS_B);
    expect(next.phase).toBe('prep');
    expect(next.setNumber).toBe(3);
  });

  it('Open set3 (last hold, last set) → done', () => {
    const s = state({ phase: 'break', setNumber: 3, holdIndex: at('b-open') });
    const next = advancePhase(s, HOLDS_B);
    expect(next.phase).toBe('done');
  });

  it('Open set3 final hang → done (no trailing break)', () => {
    const s = state({ phase: 'hanging', setNumber: 3, repIndex: 0, holdIndex: at('b-open') });
    const next = advancePhase(s, HOLDS_B);
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
  it('stays in the break and skips only the next set', () => {
    const s = state({ phase: 'break', holdIndex: 0, setNumber: 1 });
    const next = skipNextSet(s, HOLDS);
    expect(next.phase).toBe('break');
    expect(next.setNumber).toBe(1);
    expect(next.skipped).toEqual([setKey(0, 2)]);
    expect(upcomingSet(next, HOLDS)).toEqual({ holdIndex: 1, setNumber: 1 });
  });

  it('3-set hold: skipping set 2 still leaves set 3', () => {
    const holds = [hold({ numSets: 3 }), hold()];
    const s = state({ phase: 'break', holdIndex: 0, setNumber: 1 });
    const next = skipNextSet(s, holds);
    expect(upcomingSet(next, holds)).toEqual({ holdIndex: 0, setNumber: 3 });
    const after = advancePhase(next, holds);
    expect(after).toMatchObject({ phase: 'prep', holdIndex: 0, setNumber: 3, repIndex: 0 });
  });

  it('last hold, 3 sets: skipping set 2 does not end the workout', () => {
    const holds = [hold(), hold({ numSets: 3 })];
    const s = state({ phase: 'break', holdIndex: 1, setNumber: 1 });
    const next = skipNextSet(s, holds);
    expect(next.phase).toBe('break');
    expect(upcomingSet(next, holds)).toEqual({ holdIndex: 1, setNumber: 3 });
  });

  it('skipping the only set left → done', () => {
    const s = state({ phase: 'break', holdIndex: lastHoldIndex, setNumber: 1 });
    expect(skipNextSet(s, HOLDS).phase).toBe('done');
  });
});

// ── skipNextHold ──────────────────────────────────────────────────────────

describe('skipNextHold', () => {
  it('stays in the current break; the break then leads past the skipped hold', () => {
    const s = state({ phase: 'break', holdIndex: 0, setNumber: 2 });
    const next = skipNextHold(s, HOLDS);
    expect(next).toMatchObject({ phase: 'break', holdIndex: 0, setNumber: 2 });
    const after = advancePhase(next, HOLDS);
    expect(after).toMatchObject({ phase: 'prep', holdIndex: 2, setNumber: 1 });
  });

  it('skips every set of a 3-set next hold', () => {
    const holds = [hold(), hold({ numSets: 3 }), hold()];
    const s = state({ phase: 'break', holdIndex: 0, setNumber: 2 });
    const next = skipNextHold(s, holds);
    expect(next.skipped).toEqual([setKey(1, 1), setKey(1, 2), setKey(1, 3)]);
    expect(advancePhase(next, holds)).toMatchObject({ holdIndex: 2, setNumber: 1 });
  });

  it('penultimate hold (next hold = last) → done', () => {
    const s = state({ phase: 'break', holdIndex: lastHoldIndex - 1, setNumber: 2 });
    expect(skipNextHold(s, HOLDS).phase).toBe('done');
  });
});

// ── completed sets ────────────────────────────────────────────────────────

describe('completed sets', () => {
  it('marks a set completed when its last rep is hung', () => {
    const s = state({ repIndex: HOLDS[0].set1Reps - 1 });
    expect(advancePhase(s, HOLDS).completed).toEqual([setKey(0, 1)]);
  });

  it('does not mark a set completed when it is skipped mid-set', () => {
    const s = state({ repIndex: 1 });
    expect(skipSet(s, HOLDS).completed ?? []).toEqual([]);
  });

  it('marks a rest-only set completed when its break ends', () => {
    const holds = [hold({ isRestOnly: true, numSets: 1 }), hold()];
    const s = state({ phase: 'break', holdIndex: 0 });
    expect(advancePhase(s, holds).completed).toEqual([setKey(0, 1)]);
  });
});

// ── immutability ──────────────────────────────────────────────────────────

describe('immutability', () => {
  it('advancePhase does not mutate input', () => {
    const s = state({ phase: 'prep' });
    const original = { ...s };
    advancePhase(s, HOLDS);
    expect(s).toEqual(original);
  });

  it('skipSet does not mutate input', () => {
    const s = state({ setNumber: 1, holdIndex: 0 });
    const original = { ...s };
    skipSet(s, HOLDS);
    expect(s).toEqual(original);
  });
});
