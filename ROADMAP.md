# Hangboard PWA — Roadmap

_Last updated: 2026-02-24_

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

## ✅ Option 2: Second Workout

**Status: done**

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

---

## Future: Combined Climbing Training Dashboard

**Vision:** Absorb the `climbing-pyramid-tracker` app into this one, creating a unified
training + performance dashboard. The hangboard app is the right technical base.

### Why this app absorbs (not the other way around)

- **TypeScript** — essential as the codebase grows; pyramid tracker is plain JS
- **IndexedDB** — localStorage has a ~5MB cap and no indexing; pyramid tracker will hit this with climb history; IndexedDB scales indefinitely
- **PWA** — a training log should be installable and offline-capable
- **Tests** — hangboard has Vitest unit tests + Playwright E2E; pyramid tracker has none
- **Zustand** — cleaner than prop-drilling climb state through a large component tree

### What gets brought over from the pyramid tracker

- Climb data model (route name, grade, style, date, location, type, attempts)
- Mountain Project import: CSV parsing + URL import via Vercel serverless function (CORS proxy) — already Vercel-compatible
- Pyramid + timeline visualisations (`ClimbGrid.jsx` and friends)
- Grade normalisation logic (`gradeUtils.js`) — port carefully with unit tests, it's non-trivial

### Key architectural changes needed

1. **Real routing** — the current `AppView` string-switch pattern won't scale to this many
   screens. Add React Router or TanStack Router before the surface area grows further.

2. **New IndexedDB store** — add a `climbs` object store alongside `sessions` in the same
   `hangboard-history` DB. Both queryable from a unified calendar view.

3. **Calendar becomes the home screen** — the unified 12-week grid shows training type and
   performance cubes side by side. The hangboard weight picker becomes a drill-down.

4. **TypeScript-ify the pyramid tracker logic** — grade utils and CSV parsing especially.

### Training type taxonomy

| Type | Examples | Key metric |
|---|---|---|
| Hangboard | Repeaters, Max Hang | Added weight |
| Endurance | 20/30 min ARC | Duration |
| Power | Bouldering, campus, tension board | Grade / intensity |
| Power endurance | 4×4s, routes | Sets / grade |
| CIR | Continuous interval repeat — onsight-level lapping | Duration |
| Performance | Sends (from pyramid tracker) | Grade / style |

### Calendar colour scheme (proposed)

Each training type gets a distinct colour in the calendar grid, replacing the current
green/blue/purple A-B-both scheme.

### Migration path

1. Add routing
2. Migrate pyramid tracker climb data to IndexedDB
3. Port grade normalisation + CSV import to TypeScript with tests
4. Generalise `buildCalendar` to accept typed activities (not just `"a" | "b"`)
5. Build unified calendar home screen
6. Port pyramid/timeline visualisations
7. Rename / rebrand the app
