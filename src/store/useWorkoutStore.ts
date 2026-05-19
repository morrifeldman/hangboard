import { create } from "zustand";
import { persist } from "zustand/middleware";
import { HOLDS, HOLDS_B, HOLDS_TEST, SET1_REPS, SET2_REPS } from "../data/workout";
import type { HoldDefinition } from "../data/workout";
import * as SM from "../lib/stateMachine";
import { totalWorkoutSecs } from "../lib/workoutTime";

import type { WorkoutPhase } from "../lib/stateMachine";
export type { WorkoutPhase };

export type WorkoutId = "repeaters" | "max-hang" | "test";

export type StoredWeights = Record<string, { set1: number; set2: number }>;
type Overrides = Record<string, { set1: number | null; set2: number | null; set3?: number | null }>;

function overrideKeyFor(setNum: number): "set1" | "set2" | "set3" {
  return setNum <= 1 ? "set1" : setNum === 2 ? "set2" : "set3";
}

interface WorkoutStore {
  // Persisted
  weights: StoredWeights;
  weightsB: StoredWeights;
  selectedWorkout: WorkoutId;
  gymDefaults: Record<string, Record<string, string>>;

  // Session (not persisted)
  phase: WorkoutPhase;
  holdIndex: number;
  setNumber: number;
  repIndex: number;
  overrides: Overrides;
  paused: boolean;
  startedAt: number | null;
  totalScheduledSecs: number;

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
  setGymDefaults: (workoutType: string, fields: Record<string, string>) => void;
}

function defaultWeightsA(): StoredWeights {
  return Object.fromEntries(
    [...HOLDS, ...HOLDS_TEST].map((h) => [h.id, { set1: h.defaultSet1Weight, set2: h.defaultSet2Weight }])
  );
}

function defaultWeightsB(): StoredWeights {
  return Object.fromEntries(
    HOLDS_B.map((h) => [h.id, { set1: h.defaultSet1Weight, set2: h.defaultSet2Weight }])
  );
}

function holdsFor(id: WorkoutId): readonly HoldDefinition[] {
  if (id === "max-hang") return HOLDS_B;
  if (id === "test") return HOLDS_TEST;
  return HOLDS;
}

export const useWorkoutStore = create<WorkoutStore>()(
  persist(
    (set, get) => ({
      weights: defaultWeightsA(),
      weightsB: defaultWeightsB(),
      selectedWorkout: "repeaters",
      gymDefaults: {},

      phase: "idle",
      holdIndex: 0,
      setNumber: 1,
      repIndex: 0,
      overrides: {},
      paused: false,
      startedAt: null,
      totalScheduledSecs: 0,

      currentHolds: () => holdsFor(get().selectedWorkout),

      currentHold: () => holdsFor(get().selectedWorkout)[get().holdIndex],

      effectiveWeight: (holdId, setNum) => {
        // Overrides use per-set keys so set2 and set3 can be adjusted independently.
        // Stored weights only have set1/set2; set3 is always derived via setIncrement.
        const overrideKey = overrideKeyFor(setNum);
        const storedKey = setNum <= 1 ? "set1" : "set2";
        const override = get().overrides[holdId];
        const overrideVal = override?.[overrideKey] ?? null;
        if (overrideVal !== null) return overrideVal;

        const holds = holdsFor(get().selectedWorkout);
        const hold = holds.find((h) => h.id === holdId);
        const storedMap = get().selectedWorkout === "max-hang" ? get().weightsB : get().weights;
        const stored = storedMap[holdId];
        let base: number;
        if (!stored) {
          base = storedKey === "set1"
            ? (hold?.defaultSet1Weight ?? 0)
            : (hold?.defaultSet2Weight ?? 0);
        } else {
          base = stored[storedKey];
        }
        // Apply per-set increment (e.g. max hang: set1=base, set2=base+5, set3=base+10)
        if (hold?.setIncrement && setNum > 1) {
          base = (stored?.set1 ?? hold.defaultSet1Weight) + (setNum - 1) * hold.setIncrement;
        }
        return base;
      },

      setSelectedWorkout: (id) => {
        set({ selectedWorkout: id });
      },

      startWorkout: () => {
        const holds = holdsFor(get().selectedWorkout);
        set({
          phase: "prep",
          holdIndex: 0,
          setNumber: 1,
          repIndex: 0,
          overrides: {},
          startedAt: Date.now(),
          totalScheduledSecs: totalWorkoutSecs(holds, SET1_REPS, SET2_REPS),
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
        const key = overrideKeyFor(setNum);
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
        const holds = holdsFor(get().selectedWorkout);
        const hold = holds.find((h) => h.id === holdId);
        const fallback = { set1: hold?.defaultSet1Weight ?? 0, set2: hold?.defaultSet2Weight ?? 0 };
        if (get().selectedWorkout === "max-hang") {
          const stored = get().weightsB[holdId] ?? fallback;
          set({
            weightsB: {
              ...get().weightsB,
              [holdId]: { ...stored, [key]: stored[key] + delta },
            },
          });
        } else {
          const stored = get().weights[holdId] ?? fallback;
          set({
            weights: {
              ...get().weights,
              [holdId]: { ...stored, [key]: stored[key] + delta },
            },
          });
        }
      },

      resetWeights: () => {
        if (get().selectedWorkout === "max-hang") {
          set({ weightsB: defaultWeightsB() });
        } else {
          set({ weights: defaultWeightsA() });
        }
      },

      setGymDefaults: (workoutType, fields) => {
        set({ gymDefaults: { ...get().gymDefaults, [workoutType]: fields } });
      },
    }),
    {
      name: "hangboard-weights",
      partialize: (s) => ({
        weights: s.weights,
        weightsB: s.weightsB,
        selectedWorkout: s.selectedWorkout === "test" ? "repeaters" : s.selectedWorkout,
        gymDefaults: s.gymDefaults,
      }),
    }
  )
);

// Expose store on window in dev/test mode for easy state manipulation from console
if (typeof window !== "undefined" &&
    (import.meta.env.DEV || new URLSearchParams(window.location.search).has("test"))) {
  (window as unknown as Record<string, unknown>).__store = useWorkoutStore;
}
