import { create } from "zustand";
import { persist } from "zustand/middleware";
import { HOLDS, SET1_REPS, SET2_REPS } from "../data/workout";
import type { HoldDefinition } from "../data/workout";
import * as SM from "../lib/stateMachine";

import type { WorkoutPhase } from "../lib/stateMachine";
export type { WorkoutPhase };

type StoredWeights = Record<string, { set1: number; set2: number }>;
type Overrides = Record<string, { set1: number | null; set2: number | null }>;

interface WorkoutStore {
  // Persisted
  weights: StoredWeights;

  // Session (not persisted)
  phase: WorkoutPhase;
  holdIndex: number;
  setNumber: 1 | 2;
  repIndex: number;
  overrides: Overrides;
  paused: boolean;

  // Selectors
  currentHold: () => HoldDefinition;
  effectiveWeight: (holdId: string, setNum: 1 | 2) => number;

  // Actions
  startWorkout: () => void;
  advancePhase: () => void;
  skipSet: () => void;
  skipNextSet: () => void;
  skipNextHold: () => void;
  bailWorkout: () => void;
  pauseWorkout: () => void;
  resumeWorkout: () => void;
  setSessionOverride: (holdId: string, setNum: 1 | 2, delta: number) => void;
  adjustNextWeight: (holdId: string, setNum: 1 | 2, delta: number) => void;
  resetWeights: () => void;
}

function defaultWeights(): StoredWeights {
  return Object.fromEntries(
    HOLDS.map((h) => [h.id, { set1: h.defaultSet1Weight, set2: h.defaultSet2Weight }])
  );
}

export const useWorkoutStore = create<WorkoutStore>()(
  persist(
    (set, get) => ({
      weights: defaultWeights(),

      phase: "idle",
      holdIndex: 0,
      setNumber: 1,
      repIndex: 0,
      overrides: {},
      paused: false,

      currentHold: () => HOLDS[get().holdIndex],

      effectiveWeight: (holdId, setNum) => {
        const override = get().overrides[holdId];
        const overrideVal = override?.[setNum === 1 ? "set1" : "set2"] ?? null;
        if (overrideVal !== null) return overrideVal;
        const stored = get().weights[holdId];
        if (!stored) {
          const hold = HOLDS.find((h) => h.id === holdId);
          return setNum === 1
            ? (hold?.defaultSet1Weight ?? 0)
            : (hold?.defaultSet2Weight ?? 0);
        }
        return setNum === 1 ? stored.set1 : stored.set2;
      },

      startWorkout: () => {
        set({
          phase: "prep",
          holdIndex: 0,
          setNumber: 1,
          repIndex: 0,
          overrides: {},
        });
      },

      advancePhase: () => {
        set((s) => ({ ...SM.advancePhase(s, HOLDS, SET1_REPS, SET2_REPS), paused: false }));
      },

      skipSet: () => {
        set((s) => ({ ...SM.skipSet(s, HOLDS), paused: false }));
      },

      skipNextSet: () => {
        set((s) => ({ ...SM.skipNextSet(s, HOLDS), paused: false }));
      },

      skipNextHold: () => {
        set((s) => ({ ...SM.skipNextHold(s, HOLDS), paused: false }));
      },

      bailWorkout: () => {
        set({ phase: "idle", paused: false });
      },

      pauseWorkout: () => {
        set({ paused: true });
      },

      resumeWorkout: () => {
        set({ paused: false });
      },

      setSessionOverride: (holdId, setNum, delta) => {
        const current = get().overrides[holdId] ?? { set1: null, set2: null };
        const key = setNum === 1 ? "set1" : "set2";
        const base = get().effectiveWeight(holdId, setNum);
        set({
          overrides: {
            ...get().overrides,
            [holdId]: { ...current, [key]: base + delta },
          },
        });
      },

      adjustNextWeight: (holdId, setNum, delta) => {
        const stored = get().weights[holdId] ?? { set1: 0, set2: 0 };
        const key = setNum === 1 ? "set1" : "set2";
        set({
          weights: {
            ...get().weights,
            [holdId]: { ...stored, [key]: stored[key] + delta },
          },
        });
      },

      resetWeights: () => {
        set({ weights: defaultWeights() });
      },
    }),
    {
      name: "hangboard-weights",
      partialize: (s) => ({ weights: s.weights }),
    }
  )
);
