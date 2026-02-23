import { create } from "zustand";
import { persist } from "zustand/middleware";
import { HOLDS, HOLDS_B, SET1_REPS, SET2_REPS } from "../data/workout";
import type { HoldDefinition } from "../data/workout";
import * as SM from "../lib/stateMachine";

import type { WorkoutPhase } from "../lib/stateMachine";
export type { WorkoutPhase };

export type WorkoutId = "a" | "b";

type StoredWeights = Record<string, { set1: number; set2: number }>;
type Overrides = Record<string, { set1: number | null; set2: number | null }>;

interface WorkoutStore {
  // Persisted
  weights: StoredWeights;
  weightsB: StoredWeights;
  selectedWorkout: WorkoutId;

  // Session (not persisted)
  phase: WorkoutPhase;
  holdIndex: number;
  setNumber: number;
  repIndex: number;
  overrides: Overrides;
  paused: boolean;

  // Selectors
  currentHolds: () => readonly HoldDefinition[];
  currentHold: () => HoldDefinition;
  effectiveWeight: (holdId: string, setNum: number) => number;

  // Actions
  setSelectedWorkout: (id: WorkoutId) => void;
  startWorkout: () => void;
  advancePhase: () => void;
  skipSet: () => void;
  skipNextSet: () => void;
  skipNextHold: () => void;
  bailWorkout: () => void;
  pauseWorkout: () => void;
  resumeWorkout: () => void;
  setSessionOverride: (holdId: string, setNum: number, delta: number) => void;
  adjustNextWeight: (holdId: string, setNum: number, delta: number) => void;
  resetWeights: () => void;
}

function defaultWeightsA(): StoredWeights {
  return Object.fromEntries(
    HOLDS.map((h) => [h.id, { set1: h.defaultSet1Weight, set2: h.defaultSet2Weight }])
  );
}

function defaultWeightsB(): StoredWeights {
  return Object.fromEntries(
    HOLDS_B.map((h) => [h.id, { set1: h.defaultSet1Weight, set2: h.defaultSet2Weight }])
  );
}

function holdsFor(id: WorkoutId): readonly HoldDefinition[] {
  return id === "b" ? HOLDS_B : HOLDS;
}

export const useWorkoutStore = create<WorkoutStore>()(
  persist(
    (set, get) => ({
      weights: defaultWeightsA(),
      weightsB: defaultWeightsB(),
      selectedWorkout: "a",

      phase: "idle",
      holdIndex: 0,
      setNumber: 1,
      repIndex: 0,
      overrides: {},
      paused: false,

      currentHolds: () => holdsFor(get().selectedWorkout),

      currentHold: () => holdsFor(get().selectedWorkout)[get().holdIndex],

      effectiveWeight: (holdId, setNum) => {
        const key = setNum <= 1 ? "set1" : "set2";
        const override = get().overrides[holdId];
        const overrideVal = override?.[key] ?? null;
        if (overrideVal !== null) return overrideVal;

        const storedMap = get().selectedWorkout === "b" ? get().weightsB : get().weights;
        const stored = storedMap[holdId];
        if (!stored) {
          const holds = holdsFor(get().selectedWorkout);
          const hold = holds.find((h) => h.id === holdId);
          return key === "set1"
            ? (hold?.defaultSet1Weight ?? 0)
            : (hold?.defaultSet2Weight ?? 0);
        }
        return stored[key];
      },

      setSelectedWorkout: (id) => {
        set({ selectedWorkout: id });
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
        const holds = holdsFor(get().selectedWorkout);
        set((s) => ({ ...SM.advancePhase(s, holds, SET1_REPS, SET2_REPS), paused: false }));
      },

      skipSet: () => {
        const holds = holdsFor(get().selectedWorkout);
        set((s) => ({ ...SM.skipSet(s, holds), paused: false }));
      },

      skipNextSet: () => {
        const holds = holdsFor(get().selectedWorkout);
        set((s) => ({ ...SM.skipNextSet(s, holds), paused: false }));
      },

      skipNextHold: () => {
        const holds = holdsFor(get().selectedWorkout);
        set((s) => ({ ...SM.skipNextHold(s, holds), paused: false }));
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
        const key = setNum <= 1 ? "set1" : "set2";
        const current = get().overrides[holdId] ?? { set1: null, set2: null };
        const base = get().effectiveWeight(holdId, setNum);
        set({
          overrides: {
            ...get().overrides,
            [holdId]: { ...current, [key]: base + delta },
          },
        });
      },

      adjustNextWeight: (holdId, setNum, delta) => {
        const key = setNum <= 1 ? "set1" : "set2";
        if (get().selectedWorkout === "b") {
          const stored = get().weightsB[holdId] ?? { set1: 0, set2: 0 };
          set({
            weightsB: {
              ...get().weightsB,
              [holdId]: { ...stored, [key]: stored[key] + delta },
            },
          });
        } else {
          const stored = get().weights[holdId] ?? { set1: 0, set2: 0 };
          set({
            weights: {
              ...get().weights,
              [holdId]: { ...stored, [key]: stored[key] + delta },
            },
          });
        }
      },

      resetWeights: () => {
        if (get().selectedWorkout === "b") {
          set({ weightsB: defaultWeightsB() });
        } else {
          set({ weights: defaultWeightsA() });
        }
      },
    }),
    {
      name: "hangboard-weights",
      partialize: (s) => ({
        weights: s.weights,
        weightsB: s.weightsB,
        selectedWorkout: s.selectedWorkout,
      }),
    }
  )
);
