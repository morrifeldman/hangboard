import { describe, it, expect } from 'vitest';
import { advancePhase, skipSet, skipNextSet, skipNextHold } from '../stateMachine';
import type { SessionState } from '../stateMachine';
import { HOLDS } from '../../data/holds';

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

const lastHoldIndex = HOLDS.length - 1;

describe('advancePhase', () => {
  it('prep → hanging, resets repIndex to 0', () => {
    const s = state({ phase: 'prep', repIndex: 99 });
    const next = advancePhase(s, HOLDS, SET1, SET2);
    expect(next.phase).toBe('hanging');
    expect(next.repIndex).toBe(0);
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

describe('skipSet', () => {
  it('mid-workout → break', () => {
    const s = state({ setNumber: 1, holdIndex: 0 });
    const next = skipSet(s, HOLDS);
    expect(next.phase).toBe('break');
  });

  it('set2 not last hold → break', () => {
    const s = state({ setNumber: 2, holdIndex: 0 });
    const next = skipSet(s, HOLDS);
    expect(next.phase).toBe('break');
  });

  it('set2 last hold → done', () => {
    const s = state({ setNumber: 2, holdIndex: lastHoldIndex });
    const next = skipSet(s, HOLDS);
    expect(next.phase).toBe('done');
  });

  it('set1 last hold → break (not done — set2 still remains)', () => {
    const s = state({ setNumber: 1, holdIndex: lastHoldIndex });
    const next = skipSet(s, HOLDS);
    expect(next.phase).toBe('break');
  });
});

describe('skipNextSet', () => {
  it('not last hold → break, setNumber=2', () => {
    const s = state({ holdIndex: 0 });
    const next = skipNextSet(s, HOLDS);
    expect(next.phase).toBe('break');
    expect(next.setNumber).toBe(2);
  });

  it('last hold → done', () => {
    const s = state({ holdIndex: lastHoldIndex });
    const next = skipNextSet(s, HOLDS);
    expect(next.phase).toBe('done');
  });
});

describe('skipNextHold', () => {
  it('not penultimate hold → break, holdIndex+1, setNumber=2', () => {
    // With 8 holds, index 0 → nextHoldIndex=1 which is < 7, so → break
    const s = state({ holdIndex: 0 });
    const next = skipNextHold(s, HOLDS);
    expect(next.phase).toBe('break');
    expect(next.holdIndex).toBe(1);
    expect(next.setNumber).toBe(2);
  });

  it('penultimate hold (nextHold = last) → done', () => {
    // nextHoldIndex = lastHoldIndex, which is >= HOLDS.length - 1, so → done
    const s = state({ holdIndex: lastHoldIndex - 1 });
    const next = skipNextHold(s, HOLDS);
    expect(next.phase).toBe('done');
  });
});

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
