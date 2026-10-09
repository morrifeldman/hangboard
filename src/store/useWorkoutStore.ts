import { create } from "zustand";
import { persist } from "zustand/middleware";
import { HOLDS, HOLDS_B, HOLDS_TEST } from "../data/workout";
import type { HoldDefinition } from "../data/workout";
import * as SM from "../lib/stateMachine";
import type { SessionState } from "../lib/stateMachine";
import { currentPhaseFullSecs, totalWorkoutSecs } from "../lib/workoutTime";
import { saveSession, buildSessionRecord } from "../lib/history";
import { overrideKeyFor, plannedWeight, sessionSetWeight } from "../lib/setWeights";
import type { SetOverrides } from "../lib/setWeights";
import type { LiftDefinition } from "../lib/lifts";

import type { WorkoutPhase } from "../lib/stateMachine";
import { IS_TEST_MODE } from "../lib/testMode";
export type { WorkoutPhase };

export type WorkoutId = "repeaters" | "max-hang" | "test";

export type StoredWeights = Record<string, { set1: number; set2: number }>;
type Overrides = Record<string, SetOverrides>;

/** Per-hold weights from a prior session, used for the "vs last time" cue. */
export type SessionWeightLookup = Record<string, { set1: number; set2: number; set3?: number }>;

export type SetKey = "set1" | "set2" | "set3";
export type SetNotes = Record<string, Partial<Record<SetKey, string>>>;
export type FailedSets = Record<string, Partial<Record<SetKey, boolean>>>;

export function setKeyFor(setNumber: number): SetKey {
  return setNumber <= 1 ? "set1" : setNumber === 2 ? "set2" : "set3";
}

/** A workout left this long (app closed mid-session) is not offered back on reopen. */
const STALE_SESSION_MS = 12 * 60 * 60 * 1000;

interface WorkoutStore {
  // Persisted
  weights: StoredWeights;
  weightsB: StoredWeights;
  selectedWorkout: WorkoutId;
  gymDefaults: Record<string, Record<string, string>>;
  lifts: LiftDefinition[];

  // Session in progress. Persisted (outside test mode) so a reload or a killed
  // PWA comes back paused where it left off instead of losing the workout.
  phase: SM.WorkoutPhase;
  holdIndex: number;
  setNumber: number;
  repIndex: number;
  skipped: readonly string[];
  completed: readonly string[];
  overrides: Overrides;
  // Snapshot of the active weights map taken at startWorkout. The live session reads from this
  // so that adjusting *next* session's weights (which mutate `weights`/`weightsB`) can never
  // bleed into the workout in progress.
  sessionWeights: StoredWeights;
  // Per-hold weights from the most recent prior session — drives the in-session "vs last time" cue.
  lastSessionWeights: SessionWeightLookup;
  startedAt: number | null;
  totalScheduledSecs: number;
  holdNotes: Record<string, string>;
  setNotes: SetNotes;
  failedSets: FailedSets;

  // The phase clock — the one source of time for the ring, the header and expiry.
  // Running: `phaseEndsAt` is the wall-clock end. Paused: `pausedRemaining` holds
  // the seconds left and `phaseEndsAt` is null. `phaseSeq` bumps on every
  // transition so a stale expiry can never advance a phase it didn't time.
  paused: boolean;
  phaseSeq: number;
  phaseDuration: number;
  phaseEndsAt: number | null;
  pausedRemaining: number | null;

  // Selectors
  currentHolds: () => readonly HoldDefinition[];
  currentHold: () => HoldDefinition;
  /** Weight for the workout in progress (snapshot at start + any in-session overrides). */
  effectiveWeight: (holdId: string, setNum: number) => number;
  /** The persisted target weight that next session will start from. */
  nextSessionWeight: (holdId: string, setNum: number) => number;

  // Actions
  setSelectedWorkout: (id: WorkoutId) => void;
  startWorkout: (lastSessionWeights?: SessionWeightLookup) => void;
  advancePhase: () => void;
  /** Called by the clock when a phase runs out; ignored unless `seq` is still current. */
  expirePhase: (seq: number) => void;
  skipSet: () => void;
  skipNextSet: () => void;
  skipNextHold: () => void;
  /** Save the workout (as finished, or ended early) and leave it. */
  finishWorkout: (opts: { bailed: boolean; notes?: string }) => void;
  pauseWorkout: () => void;
  resumeWorkout: () => void;
  setHoldNote: (holdId: string, note: string) => void;
  setSetNote: (holdId: string, setNumber: number, note: string) => void;
  toggleFailed: (holdId: string, setNumber: number) => void;
  setSessionOverride: (holdId: string, setNum: number, delta: number) => void;
  adjustNextWeight: (holdId: string, setNum: number, delta: number) => void;
  resetWeights: () => void;
  setGymDefaults: (workoutType: string, fields: Record<string, string>) => void;
  addLift: (lift: LiftDefinition) => void;
  updateLift: (id: string, patch: Partial<Omit<LiftDefinition, "id">>) => void;
  deleteLift: (id: string) => void;
  setLiftBase: (id: string, baseWeight: number) => void;
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

const IDLE_SESSION = {
  phase: "idle" as SM.WorkoutPhase,
  holdIndex: 0,
  setNumber: 1,
  repIndex: 0,
  skipped: [] as readonly string[],
  completed: [] as readonly string[],
  overrides: {} as Overrides,
  sessionWeights: {} as StoredWeights,
  lastSessionWeights: {} as SessionWeightLookup,
  startedAt: null as number | null,
  totalScheduledSecs: 0,
  holdNotes: {} as Record<string, string>,
  setNotes: {} as SetNotes,
  failedSets: {} as FailedSets,
  paused: false,
  phaseDuration: 0,
  phaseEndsAt: null as number | null,
  pausedRemaining: null as number | null,
};

const SESSION_KEYS = Object.keys(IDLE_SESSION) as (keyof typeof IDLE_SESSION)[];

/** The clock fields for entering a phase, running from now. */
function clockFor(state: SessionState, holds: readonly HoldDefinition[], seq: number) {
  const duration = currentPhaseFullSecs(state, holds);
  const timed = state.phase !== "idle" && state.phase !== "done" && duration > 0;
  return {
    paused: false,
    phaseSeq: seq + 1,
    phaseDuration: duration,
    phaseEndsAt: timed ? Date.now() + duration * 1000 : null,
    pausedRemaining: null,
  };
}

export const useWorkoutStore = create<WorkoutStore>()(
  persist(
    (set, get) => ({
      weights: defaultWeightsA(),
      weightsB: defaultWeightsB(),
      selectedWorkout: "repeaters",
      gymDefaults: {},
      lifts: [],

      ...IDLE_SESSION,
      phaseSeq: 0,

      currentHolds: () => holdsFor(get().selectedWorkout),

      currentHold: () => holdsFor(get().selectedWorkout)[get().holdIndex],

      effectiveWeight: (holdId, setNum) => {
        const holds = holdsFor(get().selectedWorkout);
        const hold = holds.find((h) => h.id === holdId);
        // Read from the start-of-session snapshot so next-session edits don't affect the live workout.
        // Fall back to the persisted map before a session has started (snapshot empty).
        const snap = get().sessionWeights;
        const persisted = get().selectedWorkout === "max-hang" ? get().weightsB : get().weights;
        const storedMap = Object.keys(snap).length ? snap : persisted;
        return sessionSetWeight(hold, storedMap[holdId], get().overrides[holdId], setNum);
      },

      nextSessionWeight: (holdId, setNum) => {
        const holds = holdsFor(get().selectedWorkout);
        const hold = holds.find((h) => h.id === holdId);
        const persisted = get().selectedWorkout === "max-hang" ? get().weightsB : get().weights;
        return plannedWeight(hold, persisted[holdId], setNum);
      },

      setSelectedWorkout: (id) => {
        set({ selectedWorkout: id });
      },

      startWorkout: (lastSessionWeights) => {
        const wid = get().selectedWorkout;
        const holds = holdsFor(wid);
        const activeMap = wid === "max-hang" ? get().weightsB : get().weights;
        const first: SessionState = { ...SM.INITIAL_STATE };
        set({
          ...IDLE_SESSION,
          ...first,
          // Freeze the weights for the duration of this workout.
          sessionWeights: { ...activeMap },
          lastSessionWeights: lastSessionWeights ?? {},
          startedAt: Date.now(),
          totalScheduledSecs: totalWorkoutSecs(holds),
          ...clockFor(first, holds, get().phaseSeq),
        });
      },

      advancePhase: () => {
        const holds = holdsFor(get().selectedWorkout);
        const next = SM.advancePhase(get(), holds);
        if (next.phase === "idle") {
          set({ ...IDLE_SESSION, phaseSeq: get().phaseSeq + 1 });
          return;
        }
        set({ ...next, ...clockFor(next, holds, get().phaseSeq) });
      },

      expirePhase: (seq) => {
        const s = get();
        if (s.phaseSeq !== seq || s.paused || s.phaseEndsAt === null) return;
        s.advancePhase();
      },

      skipSet: () => {
        const holds = holdsFor(get().selectedWorkout);
        const next = SM.skipSet(get(), holds);
        set({ ...next, ...clockFor(next, holds, get().phaseSeq) });
      },

      // Skipping ahead from a break keeps the break's clock running: the rest
      // already taken still counts.
      skipNextSet: () => {
        const holds = holdsFor(get().selectedWorkout);
        const next = SM.skipNextSet(get(), holds);
        set(next.phase === get().phase ? { skipped: next.skipped } : { ...next, ...clockFor(next, holds, get().phaseSeq) });
      },

      skipNextHold: () => {
        const holds = holdsFor(get().selectedWorkout);
        const next = SM.skipNextHold(get(), holds);
        set(next.phase === get().phase ? { skipped: next.skipped } : { ...next, ...clockFor(next, holds, get().phaseSeq) });
      },

      finishWorkout: ({ bailed, notes }) => {
        const s = get();
        if (s.selectedWorkout !== "test" && s.startedAt !== null) {
          const record = buildSessionRecord({
            workoutType: s.selectedWorkout,
            startedAt: s.startedAt,
            completedAt: Date.now(),
            bailed,
            completedSets: s.completed,
            holds: holdsFor(s.selectedWorkout),
            effectiveWeight: s.effectiveWeight,
            nextWeight: s.nextSessionWeight,
            notes: notes || undefined,
            holdNotes: s.holdNotes,
            setNotes: s.setNotes,
            failedSets: s.failedSets,
          });
          saveSession(record).catch(console.error);
        }
        set({ ...IDLE_SESSION, phaseSeq: s.phaseSeq + 1 });
      },

      pauseWorkout: () => {
        const { phaseEndsAt, paused } = get();
        if (paused || phaseEndsAt === null) return;
        set({
          paused: true,
          phaseEndsAt: null,
          pausedRemaining: Math.max(0, (phaseEndsAt - Date.now()) / 1000),
        });
      },

      resumeWorkout: () => {
        const { pausedRemaining, paused } = get();
        if (!paused || pausedRemaining === null) return;
        set({ paused: false, phaseEndsAt: Date.now() + pausedRemaining * 1000, pausedRemaining: null });
      },

      setHoldNote: (holdId, note) => {
        set({ holdNotes: { ...get().holdNotes, [holdId]: note } });
      },

      setSetNote: (holdId, setNumber, note) => {
        const notes = get().setNotes;
        set({ setNotes: { ...notes, [holdId]: { ...notes[holdId], [setKeyFor(setNumber)]: note } } });
      },

      toggleFailed: (holdId, setNumber) => {
        const failed = get().failedSets;
        const key = setKeyFor(setNumber);
        set({ failedSets: { ...failed, [holdId]: { ...failed[holdId], [key]: !failed[holdId]?.[key] } } });
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

      addLift: (lift) => {
        set({ lifts: [...get().lifts, lift] });
      },

      updateLift: (id, patch) => {
        set({ lifts: get().lifts.map((l) => (l.id === id ? { ...l, ...patch } : l)) });
      },

      deleteLift: (id) => {
        set({ lifts: get().lifts.filter((l) => l.id !== id) });
      },

      setLiftBase: (id, baseWeight) => {
        get().updateLift(id, { baseWeight });
      },
    }),
    {
      name: "hangboard-weights",
      version: 1,
      // v0 had no session fields; everything else is unchanged, so the
      // default shallow merge with fresh defaults is the whole migration.
      migrate: (persisted) => persisted as Partial<WorkoutStore>,
      partialize: (s): Partial<WorkoutStore> => ({
        weights: s.weights,
        weightsB: s.weightsB,
        selectedWorkout: s.selectedWorkout === "test" ? "repeaters" : s.selectedWorkout,
        gymDefaults: s.gymDefaults,
        lifts: s.lifts,
        // The workout in progress. Test-mode workouts are never kept.
        ...(s.phase !== "idle" && s.selectedWorkout !== "test"
          ? Object.fromEntries(SESSION_KEYS.map((k) => [k, s[k]]))
          : {}),
      }),
      // A restored workout comes back paused, with the time it had left when the
      // app went away (or none, for a stale one).
      merge: (persisted, current) => {
        const p = { ...(persisted as Partial<WorkoutStore>) };
        const active = p.phase !== undefined && p.phase !== "idle";
        if (!active || p.startedAt == null || Date.now() - p.startedAt > STALE_SESSION_MS) {
          for (const k of SESSION_KEYS) delete p[k];
          return { ...current, ...p };
        }
        const left =
          p.pausedRemaining ??
          (p.phaseEndsAt != null ? Math.max(0, (p.phaseEndsAt - Date.now()) / 1000) : null);
        return {
          ...current,
          ...p,
          paused: left !== null,
          phaseEndsAt: null,
          pausedRemaining: left,
        };
      },
    }
  )
);

// Expose store on window in dev/test mode for easy state manipulation from console
if (typeof window !== "undefined" &&
    (import.meta.env.DEV || IS_TEST_MODE)) {
  (window as unknown as Record<string, unknown>).__store = useWorkoutStore;
}
