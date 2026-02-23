# Hangboard PWA — Roadmap

_Last updated: 2026-02-22_

## ✅ Option 1: Faster Tests / State Machine Extraction

**Status: in progress**

**Problem:** Playwright suite runs ~3 min because integration tests wait on real timers
(2s hang × reps, 1s rest × reps) to verify state transitions that are actually pure logic.

**Approach:**
- Extract `advancePhase`, `skipSet`, `skipNextSet`, `skipNextHold` from Zustand store
  into a pure function in `src/lib/stateMachine.ts`
- Add Vitest unit tests (~20 cases) covering every state transition in milliseconds
- Remove 3 slow Playwright tests (60–180s wait each) now covered by unit tests
- Keep 4 E2E tests that verify real timer firing and UI wiring

**Result:** Test suite drops from ~3 min → ~30s. Higher velocity for Options 2 and 3.

---

## Option 2: Second Workout

**Complexity: Medium**

**What it means:**
- New hold sequence (user provides data)
- Workout picker on HomeScreen
- Separate weight persistence per workout type (separate localStorage key)

**Key design decisions:**
- New `HOLDS_B` array in a separate data file (or a `workouts/` directory)
- `startWorkout(workoutType)` takes a parameter; store tracks `currentWorkout`
- `HOLDS` in store replaced by `currentHolds` derived from `currentWorkout`
- `weights` persistence keyed by `"hangboard-weights-{workoutType}"` (separate Zustand persist stores, or one store with nested keys)
- Workout picker: radio/toggle on HomeScreen, persisted to localStorage

**Test impact:** Unit tests need parameterized hold arrays — easy with the extracted
state machine. E2E tests: 1-2 extra tests for the picker UI, no new timer tests needed.

**Recommended order:** Do after Option 1 so state machine tests cover both workouts.

---

## Option 3: Workout History

**Complexity: High — zero infrastructure today**

**What it means:**
- Log each completed session (timestamp, hold results, weights used, duration)
- History screen with list of past sessions
- Optional: progress graph (weight over time per hold)
- Optional: backfill from existing workout table the user provides

**Architecture decisions:**
- **Storage:** IndexedDB via `idb` package (localStorage too small for history)
- **New state:** `workoutLog: SessionRecord[]` in a separate Zustand store (not persisted via Zustand — use idb directly)
- **Session record schema:**
  ```ts
  type SessionRecord = {
    id: string;           // crypto.randomUUID()
    workoutType: string;  // 'default' | 'campus' | ...
    startedAt: number;    // Date.now()
    completedAt: number;
    holds: Array<{
      holdId: string;
      set1: { weight: number; reps: number; completed: boolean };
      set2: { weight: number; reps: number; completed: boolean };
    }>;
    bailed?: boolean;
  };
  ```
- **Tracking:** `startWorkout()` captures `startedAt`; each hold completion captured in `advancePhase`; `done` phase writes record to idb
- **History screen:** New route or modal; list of sessions → expand to see per-hold details
- **Graph:** Recharts or a simple SVG sparkline per hold (weight set1/set2 over sessions)

**Backfill:** User can provide a CSV/table; write a one-off import script that
inserts records into idb via a hidden `/import` page or a Node script.

**Test impact:** New unit tests for session record construction; 1-2 E2E tests for history screen rendering.

**Recommended order:** Do after Option 1 (fast tests) and optionally Option 2 (if history should cover multiple workout types from the start).
