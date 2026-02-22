import { create } from "zustand";
import { persist } from "zustand/middleware";
import { HOLDS, SET1_REPS, SET2_REPS } from "../data/workout";
import type { HoldDefinition } from "../data/workout";

export type WorkoutPhase =
  | "idle"
  | "prep"
  | "hanging"
  | "resting"
  | "break"
  | "done";

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
        const { phase, holdIndex, setNumber, repIndex } = get();
        const totalReps = setNumber === 1 ? SET1_REPS : SET2_REPS;
        const isLastRep = repIndex >= totalReps - 1;
        const isLastHold = holdIndex >= HOLDS.length - 1;

        switch (phase) {
          case "prep":
            set({ phase: "hanging", repIndex: 0, paused: false });
            break;

          case "hanging":
            if (!isLastRep) {
              set({ phase: "resting", paused: false });
            } else if (setNumber === 1) {
              set({ phase: "break", paused: false });
            } else if (isLastHold) {
              set({ phase: "done", paused: false });
            } else {
              set({ phase: "break", paused: false });
            }
            break;

          case "resting":
            set({ phase: "hanging", repIndex: repIndex + 1, paused: false });
            break;

          case "break":
            if (setNumber === 1) {
              set({ phase: "prep", setNumber: 2, repIndex: 0, paused: false });
            } else {
              set({ phase: "prep", holdIndex: holdIndex + 1, setNumber: 1, repIndex: 0, paused: false });
            }
            break;

          case "done":
            set({ phase: "idle", paused: false });
            break;
        }
      },

      skipSet: () => {
        const { holdIndex, setNumber } = get();
        const isLastHold = holdIndex >= HOLDS.length - 1;
        if (setNumber === 2 && isLastHold) {
          set({ phase: "done", paused: false });
        } else {
          set({ phase: "break", paused: false });
        }
      },

      skipNextSet: () => {
        const { holdIndex } = get();
        const isLastHold = holdIndex >= HOLDS.length - 1;
        if (isLastHold) {
          set({ phase: "done", paused: false });
        } else {
          set({ setNumber: 2, phase: "break", paused: false });
        }
      },

      skipNextHold: () => {
        const { holdIndex } = get();
        const nextHoldIndex = holdIndex + 1;
        if (nextHoldIndex >= HOLDS.length - 1) {
          set({ phase: "done", paused: false });
        } else {
          set({ holdIndex: nextHoldIndex, setNumber: 2, phase: "break", paused: false });
        }
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
