# Plan: Workout History (Option 3)

## Summary
Add persistent workout history: every completed or bailed session is logged to IndexedDB and viewable on a new History screen accessible from HomeScreen.

No progress graph in this iteration — list view only.

---

## Architecture Decisions

- **Storage**: IndexedDB via `idb` package (as per ROADMAP; localStorage too small for long-term history)
- **Navigation**: Local `view` state in `App.tsx` — `"home" | "history"`. History is a full-screen peer to HomeScreen. No router needed.
- **Session saving**: Handled in `WorkoutScreen.tsx` effects (keeps the Zustand store synchronous)
- **`test` workout**: Not logged to history
- **Graph**: Deferred to a future iteration

---

## SessionRecord Schema

```ts
// src/lib/history.ts
export type SessionSetRecord = {
  weight: number;
  reps: number;
  completed: boolean;
};

export type SessionHoldRecord = {
  holdId: string;
  holdName: string;
  set1: SessionSetRecord;
  set2: SessionSetRecord | null;  // null when hold.numSets === 1
};

export type SessionRecord = {
  id: string;            // crypto.randomUUID()
  workoutType: "a" | "b";
  startedAt: number;     // Date.now() at startWorkout()
  completedAt: number;   // Date.now() at done/bail
  bailed: boolean;
  holds: SessionHoldRecord[];
};
```

---

## Per-Hold Completion Logic (in buildSessionRecord)

Called at session end with `{ holdIndex, setNumber, bailed, holds, effectiveWeight }`.

For each hold `i`:
- **Hold i < holdIndex**: set1 completed=true, set2 completed=true (hold is fully past)
- **Hold i === holdIndex (bail case)**:
  - set1 completed = `setNumber >= 2` (we started set 2, so set 1 is done)
  - set2 completed = false (bail means we never finished set 2)
- **Hold i > holdIndex**: set1 completed=false, set2 completed=false
- **Fully done (not bailed)**: all sets completed=true regardless of index

---

## Files

### New Files

**`src/lib/history.ts`**
- `SessionRecord`, `SessionHoldRecord`, `SessionSetRecord` types
- `openHistoryDB()` — opens idb DB `"hangboard-history"`, store `"sessions"`, index on `startedAt`
- `addSession(record: SessionRecord): Promise<void>`
- `getSessions(): Promise<SessionRecord[]>` — newest first
- `deleteSession(id: string): Promise<void>` — for future use
- `buildSessionRecord(args): SessionRecord` — pure function, unit-testable

**`src/components/HistoryScreen.tsx`**
- Back button → calls `onBack()`
- Loads sessions from idb via `useEffect` on mount
- Renders chronological list (newest first)
- Each entry: date/time, "Workout A" / "Workout B" badge, duration, "Bailed" indicator
- Tap to expand: shows per-hold rows with set1/set2 weights and a ✓/✗ per set
- Empty state: "No workouts yet."

**`src/lib/__tests__/history.test.ts`**
- Unit tests for `buildSessionRecord` covering: full completion, bail mid-workout, bail at set boundary

### Modified Files

**`src/store/useWorkoutStore.ts`**
- Add `startedAt: number | null` to non-persisted session state (default `null`)
- `startWorkout()` sets `startedAt: Date.now()`
- `bailWorkout()` sets `phase: "idle"` (no change needed — WorkoutScreen reads `startedAt` before calling bail)
- `partialize` already excludes non-persisted fields — no change needed

**`src/components/WorkoutScreen.tsx`**
- Add `startedAt` and `effectiveWeight` selectors from store
- In the `phase === "done"` useEffect: call `addSession(buildSessionRecord(...))` before the 3s timeout (fire-and-forget, catch+log errors)
- In `handleEndClick` bail path: call `addSession(buildSessionRecord(..., bailed: true))` before `bailWorkout()`

**`src/App.tsx`**
- Add `const [view, setView] = useState<"home" | "history">("home")`
- Add branch: `if (view === "history") return <HistoryScreen onBack={() => setView("home")} />`
- Pass `onShowHistory={() => setView("history")}` to `<HomeScreen />`

**`src/components/HomeScreen.tsx`**
- Accept `onShowHistory: () => void` prop
- Add a small "History" icon button (clock icon, SVG) in the top-right of the header

---

## idb Schema

- DB name: `"hangboard-history"`, version 1
- Object store: `"sessions"`, keyPath: `"id"`
- Index: `"by-start"` on `"startedAt"` (for sorted reads)

---

## HistoryScreen UI Sketch

```
┌─────────────────────────────┐
│ ←  Workout History          │  ← header (bg-gray-800)
├─────────────────────────────┤
│ Feb 22, 2026 · 7:34 PM      │
│ Workout A  ·  42 min  ·  ✓  │  ← session card (tap to expand)
├─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┤
│   Jug          BW / BW  ✓✓  │
│   Large Edge   BW / BW  ✓✓  │
│   …                         │
├─────────────────────────────┤
│ Feb 20, 2026 · 6:12 PM      │
│ Workout B  ·  12 min  · ⚠️  │  ← bailed
└─────────────────────────────┘
```

Weight display: show `+Nkg` if positive, `BW` if 0, `-Nkg` if negative.

---

## Test Plan

1. **Unit tests** (`src/lib/__tests__/history.test.ts`): `buildSessionRecord` for full completion, mid-workout bail, set-boundary bail — no idb needed
2. **E2E** (optional, low priority): 1 Playwright test that completes a test workout and checks the history screen shows 1 entry

---

## Implementation Order

1. `npm install idb`
2. Create `src/lib/history.ts` (types + idb ops + `buildSessionRecord`)
3. Add unit tests for `buildSessionRecord`
4. Add `startedAt` to store
5. Update `WorkoutScreen.tsx` to save on done/bail
6. Create `HistoryScreen.tsx`
7. Update `App.tsx` + `HomeScreen.tsx` for navigation
8. `npm run build` to verify no TS errors
9. `npm run test:unit` to confirm all 20+ tests pass
