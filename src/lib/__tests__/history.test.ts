import { describe, it, expect } from 'vitest';
import { buildSessionRecord } from '../history';
import { setKey } from '../stateMachine';
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

function weights(holdId: string, setNum: number): number {
  const h = HOLDS.find((h) => h.id === holdId)!;
  return setNum === 1 ? h.defaultSet1Weight : h.defaultSet2Weight;
}

// Every set of HOLDS finished.
const ALL = HOLDS.flatMap((_, i) => [setKey(i, 1), setKey(i, 2)]);

const BASE = {
  workoutType: 'repeaters' as const,
  startedAt: 1000,
  completedAt: 2000,
  holds: HOLDS,
  effectiveWeight: weights,
};

describe('buildSessionRecord', () => {
  it('marks all sets completed on a full completion', () => {
    const rec = buildSessionRecord({ ...BASE, bailed: false, completedSets: ALL });
    expect(rec.bailed).toBe(false);
    for (const h of rec.holds) {
      expect(h.set1.completed).toBe(true);
      expect(h.set2?.completed).toBe(true);
    }
  });

  it('captures correct weights from effectiveWeight', () => {
    const rec = buildSessionRecord({ ...BASE, bailed: false, completedSets: ALL });
    expect(rec.holds[1].set1.weight).toBe(5);
    expect(rec.holds[1].set2!.weight).toBe(10);
    expect(rec.holds[2].set1.weight).toBe(-10);
  });

  it('omits next target when nextWeight is not provided', () => {
    const rec = buildSessionRecord({ ...BASE, bailed: false, completedSets: ALL });
    expect(rec.holds[1].next).toBeUndefined();
  });

  it('captures next-session target from nextWeight (independent of done weights)', () => {
    const rec = buildSessionRecord({
      ...BASE,
      bailed: false,
      completedSets: ALL,
      // Next session is +5 on every set, while effectiveWeight (done) stays at base.
      nextWeight: (id, setNum) => weights(id, setNum) + 5,
    });
    // Done weight unchanged…
    expect(rec.holds[1].set1.weight).toBe(5);
    expect(rec.holds[1].set2!.weight).toBe(10);
    // …next target reflects the bump.
    expect(rec.holds[1].next).toEqual({ set1: 10, set2: 15 });
  });

  it('captures reps from hold definition', () => {
    const rec = buildSessionRecord({ ...BASE, bailed: false, completedSets: ALL });
    expect(rec.holds[0].set1.reps).toBe(7);
    expect(rec.holds[0].set2!.reps).toBe(6);
  });

  it('marks only the sets the state machine recorded as completed', () => {
    // Ended early during the break after hold 1, set 1.
    const rec = buildSessionRecord({
      ...BASE,
      bailed: true,
      completedSets: [setKey(0, 1), setKey(0, 2), setKey(1, 1)],
    });
    expect(rec.holds[0].set1.completed).toBe(true);
    expect(rec.holds[0].set2?.completed).toBe(true);
    // The set just finished counts, even though the break hadn't moved setNumber on.
    expect(rec.holds[1].set1.completed).toBe(true);
    expect(rec.holds[1].set2?.completed).toBe(false);
    expect(rec.holds[2].set1.completed).toBe(false);
  });

  it('a finished workout with skipped sets does not mark them completed', () => {
    const rec = buildSessionRecord({
      ...BASE,
      bailed: false,
      completedSets: ALL.filter((k) => k !== setKey(1, 2)),
    });
    expect(rec.bailed).toBe(false);
    expect(rec.holds[1].set1.completed).toBe(true);
    expect(rec.holds[1].set2?.completed).toBe(false);
  });

  it('a set marked failed is not completed', () => {
    const rec = buildSessionRecord({
      ...BASE,
      bailed: false,
      completedSets: ALL,
      failedSets: { edge: { set2: true } },
    });
    expect(rec.holds[1].set1.completed).toBe(true);
    expect(rec.holds[1].set2?.completed).toBe(false);
  });

  it('hold with numSets=1 has null set2', () => {
    const singleSetHolds = [
      hold({ id: 'pullup', name: 'Pull-up', numSets: 1 }),
    ];
    const rec = buildSessionRecord({
      ...BASE,
      bailed: false,
      completedSets: [setKey(0, 1)],
      holds: singleSetHolds,
      effectiveWeight: () => 0,
    });
    expect(rec.holds[0].set2).toBeNull();
  });

  it('sets correct metadata fields', () => {
    const rec = buildSessionRecord({ ...BASE, bailed: true, completedSets: [] });
    expect(rec.workoutType).toBe('repeaters');
    expect(rec.startedAt).toBe(1000);
    expect(rec.completedAt).toBe(2000);
    expect(rec.bailed).toBe(true);
    expect(typeof rec.id).toBe('string');
    expect(rec.id.length).toBeGreaterThan(0);
  });

  it('uses repsPerSet override when defined', () => {
    const h = [hold({ id: 'test', name: 'T', repsPerSet: 5 })];
    const rec = buildSessionRecord({ ...BASE, bailed: false, completedSets: ALL, holds: h, effectiveWeight: () => 0 });
    expect(rec.holds[0].set1.reps).toBe(5);
    expect(rec.holds[0].set2!.reps).toBe(5);
  });

  it('populates hold notes when holdNotes provided', () => {
    const rec = buildSessionRecord({
      ...BASE,
      bailed: false,
      completedSets: ALL,
      holdNotes: { edge: 'felt easy' },
    });
    expect(rec.holds.find((h) => h.holdId === 'edge')?.notes).toBe('felt easy');
    expect(rec.holds.find((h) => h.holdId === 'jug')?.notes).toBeUndefined();
    expect(rec.holds.find((h) => h.holdId === 'slop')?.notes).toBeUndefined();
  });

  it('leaves all hold notes undefined when holdNotes not provided', () => {
    const rec = buildSessionRecord({ ...BASE, bailed: false, completedSets: ALL });
    for (const h of rec.holds) {
      expect(h.notes).toBeUndefined();
    }
  });
});
