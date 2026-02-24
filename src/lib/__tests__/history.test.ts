import { describe, it, expect } from 'vitest';
import { buildSessionRecord } from '../history';
import type { HoldDefinition } from '../../data/holds';

// Minimal hold factory
function hold(overrides: Partial<HoldDefinition> & { id: string; name: string }): HoldDefinition {
  return {
    defaultSet1Weight: 0,
    defaultSet2Weight: 0,
    set1Reps: 7,
    set2Reps: 6,
    ...overrides,
  };
}

const HOLDS = [
  hold({ id: 'jug',  name: 'Jug',  defaultSet1Weight: 0,  defaultSet2Weight: 0 }),
  hold({ id: 'edge', name: 'Edge', defaultSet1Weight: 5,  defaultSet2Weight: 10 }),
  hold({ id: 'slop', name: 'Sloper', defaultSet1Weight: -10, defaultSet2Weight: -5 }),
];

function weights(holdId: string, setNum: 1 | 2): number {
  const h = HOLDS.find((h) => h.id === holdId)!;
  return setNum === 1 ? h.defaultSet1Weight : h.defaultSet2Weight;
}

const BASE = {
  workoutType: 'a' as const,
  startedAt: 1000,
  completedAt: 2000,
  holds: HOLDS,
  effectiveWeight: weights,
};

describe('buildSessionRecord', () => {
  it('marks all sets completed on a full completion', () => {
    const rec = buildSessionRecord({ ...BASE, bailed: false, holdIndex: 2, setNumber: 2 });
    expect(rec.bailed).toBe(false);
    for (const h of rec.holds) {
      expect(h.set1.completed).toBe(true);
      expect(h.set2?.completed).toBe(true);
    }
  });

  it('captures correct weights from effectiveWeight', () => {
    const rec = buildSessionRecord({ ...BASE, bailed: false, holdIndex: 2, setNumber: 2 });
    expect(rec.holds[1].set1.weight).toBe(5);
    expect(rec.holds[1].set2!.weight).toBe(10);
    expect(rec.holds[2].set1.weight).toBe(-10);
  });

  it('captures reps from hold definition', () => {
    const rec = buildSessionRecord({ ...BASE, bailed: false, holdIndex: 0, setNumber: 1 });
    expect(rec.holds[0].set1.reps).toBe(7);
    expect(rec.holds[0].set2!.reps).toBe(6);
  });

  it('holds before bail index are both completed', () => {
    // Bailed at hold 2, set 1
    const rec = buildSessionRecord({ ...BASE, bailed: true, holdIndex: 2, setNumber: 1 });
    expect(rec.holds[0].set1.completed).toBe(true);
    expect(rec.holds[0].set2?.completed).toBe(true);
    expect(rec.holds[1].set1.completed).toBe(true);
    expect(rec.holds[1].set2?.completed).toBe(true);
  });

  it('bail during set 1 of current hold: set1 incomplete', () => {
    // setNumber=1 means we never got to set 2
    const rec = buildSessionRecord({ ...BASE, bailed: true, holdIndex: 1, setNumber: 1 });
    expect(rec.holds[1].set1.completed).toBe(false);
    expect(rec.holds[1].set2?.completed).toBe(false);
  });

  it('bail during set 2 of current hold: set1 complete, set2 incomplete', () => {
    // setNumber=2 means set 1 is done, mid-set-2
    const rec = buildSessionRecord({ ...BASE, bailed: true, holdIndex: 1, setNumber: 2 });
    expect(rec.holds[1].set1.completed).toBe(true);
    expect(rec.holds[1].set2?.completed).toBe(false);
  });

  it('holds after bail index are both incomplete', () => {
    const rec = buildSessionRecord({ ...BASE, bailed: true, holdIndex: 0, setNumber: 1 });
    expect(rec.holds[1].set1.completed).toBe(false);
    expect(rec.holds[1].set2?.completed).toBe(false);
    expect(rec.holds[2].set1.completed).toBe(false);
    expect(rec.holds[2].set2?.completed).toBe(false);
  });

  it('hold with numSets=1 has null set2', () => {
    const singleSetHolds = [
      hold({ id: 'pullup', name: 'Pull-up', numSets: 1 }),
    ];
    const rec = buildSessionRecord({
      ...BASE,
      bailed: false,
      holdIndex: 0,
      setNumber: 1,
      holds: singleSetHolds,
      effectiveWeight: () => 0,
    });
    expect(rec.holds[0].set2).toBeNull();
  });

  it('sets correct metadata fields', () => {
    const rec = buildSessionRecord({ ...BASE, bailed: true, holdIndex: 0, setNumber: 1 });
    expect(rec.workoutType).toBe('a');
    expect(rec.startedAt).toBe(1000);
    expect(rec.completedAt).toBe(2000);
    expect(rec.bailed).toBe(true);
    expect(typeof rec.id).toBe('string');
    expect(rec.id.length).toBeGreaterThan(0);
  });

  it('uses repsPerSet override when defined', () => {
    const h = [hold({ id: 'test', name: 'T', repsPerSet: 5 })];
    const rec = buildSessionRecord({ ...BASE, bailed: false, holdIndex: 0, setNumber: 1, holds: h, effectiveWeight: () => 0 });
    expect(rec.holds[0].set1.reps).toBe(5);
    expect(rec.holds[0].set2!.reps).toBe(5);
  });
});
