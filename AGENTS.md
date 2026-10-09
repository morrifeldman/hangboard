# Cairn (Hangboard PWA) — Agent Onboarding

This file is the canonical onboarding doc for AI coding agents. Repo dir is still `~/hangboard/` for historical reasons; the user-facing app is **Cairn**. IndexedDB and localStorage keys also still use the `hangboard-*` prefix — never rename them.

## Stack
Vite 7 · React 19 · TypeScript 5.9 (strict) · Tailwind 3 · Zustand 5 · vite-plugin-pwa 1.3 · Recharts · Vitest 4 · Playwright 1.58

## Commands

```bash
scripts/start-dev.sh # dev server on :5173 in tmux session `cairn-dev` (see below)
npm run dev          # same server in the foreground
npm run build        # tsc -b && vite build → dist/
npm run lint         # ESLint (rules-of-hooks etc. are errors — keep it at zero)
npm run test:unit    # Vitest (~370 cases, no browser; runs in America/Los_Angeles)
npm run test:unit:watch
npx playwright test  # E2E suite (auto-starts its own dev server on :5174)
```

### Dev server ownership

The dev server lives in tmux session `cairn-dev`, so it survives any single
terminal or Claude session. `start-dev.sh` also links it as a window into the
tmux session it was run from, so it's one `Ctrl-b n` away.

- Check before starting: `tmux ls` and `ss -tln | grep 5173`. Never double-start.
- Logs: `tmux capture-pane -pt cairn-dev`.
- Stop: `tmux send-keys -t cairn-dev C-c`.

A pre-commit hook at `scripts/pre-commit` runs `npm run build` and `npm run lint`. Install once: `cp scripts/pre-commit .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit`.

## Version Control: use `jj`, not raw `git`

The repo is a colocated jj+git checkout (`.jj/` alongside `.git/`). Both work, but the user's surface is jj. Common equivalents:

| Want | Use |
|------|-----|
| status / diff | `jj st`, `jj diff` |
| commit | `jj describe -m "msg"` (sets message on @, the working-copy change) |
| start new change | `jj new` |
| move main forward | `jj bookmark set main -r @-` |
| push | `jj git push --bookmark main` |

Branches are **bookmarks** in jj and don't auto-advance. Typical flow:

```
# make edits
jj describe -m "Commit message"
jj new
jj bookmark set main -r @-
jj git push --bookmark main
```

## Architecture

### Routing (`src/router.tsx`)

TanStack Router owns navigation. There is no `App.tsx` any more: the route tree
is the shell.

- Tabs are real paths: `/` (Progress), `/schedule`, `/workout`, `/history`. They
  hang off a pathless `shellRoute` that draws the tab bar.
- Drill-in screens are siblings of the shell, so they render full-screen with no
  tab bar: `/settings`, `/pyramid`, `/pyramid/scrolling`, `/import`,
  `/sessions/$sessionId/edit`, `/notes/new`, `/notes/$noteId/edit`.
- Editors load their record by id in a route `loader` and redirect to `/history`
  when it's gone, so a stale deep link can't render an empty form.
- View state lives in search params: `/history?filter=&q=&tags=&types=` and
  `/?workout=&hold=&granularity=`. Updates pass `replace: true`, otherwise every
  keystroke in the search box would become its own back press. Defaults are
  omitted so the plain screens stay at bare URLs.
- Editor routes render their screen with `key={record.id}`, so moving between
  two records' editors can't carry form state across.
- `useGoBack(fallback)` backs the on-screen chevrons. It pops real history when
  there is any, and navigates to the fallback when a screen was opened cold.
- A running workout takes over the screen from `RootLayout`, and `useBlocker`
  stops back from abandoning it. End (hidden on the Done screen, where Save is
  the way out) is the only way out.
- Scroll position of the inner scrollers is `src/hooks/useScrollRestore.ts`, not
  the router. Screens scroll a child `div`, which the router's window-level
  restoration can't see. Keys are per screen (`"history"`, `"progress"`, …);
  `forgetScrollPosition(key)` drops one, which is what sends you to the top of
  History after logging a workout.

### Core
- `src/data/holds.ts` — `HoldDefinition` + `HOLDS` (Workout A), and `repsFor(hold, set)` / `numSetsOf(hold)`: the only place the reps/sets rules live.
- `src/data/workout-b.ts` — `HOLDS_B` (Workout B: MacLeod Max Hang, 9 items, 3 sets, 5lb increments).
- `src/data/workout.ts` — re-exports the hold lists + default phase lengths (`PREP_SECS`, `HANG_SECS`, `REST_SECS`, `BREAK_SECS`); holds can override each.
- `src/lib/stateMachine.ts` — pure `advancePhase`/`skipSet`/`skipNextSet`/`skipNextHold`. `SessionState` carries `skipped` and `completed` set keys (`setKey(holdIndex, setNumber)`); `upcomingSet()` is the single answer to "what comes next" (state machine, time estimate and break screen all use it). Skips drop exactly the set/hold they name and keep the current break running.
- `src/lib/workoutTime.ts` — remaining/total time, built on `upcomingSet`. A test walks the real state machine through A and B and checks the estimate at every phase — keep it passing when either file changes.
- `src/store/useWorkoutStore.ts` — Zustand store (persist key `hangboard-weights`, version 1). Persists weights, `selectedWorkout`, `gymDefaults`, the lift library, **and the workout in progress** (not for the test workout): a reload comes back paused where it was; sessions older than 12h are dropped. Owns the phase clock — `phaseEndsAt` (running) / `pausedRemaining` (paused) / `phaseSeq` (bumps every transition) — plus in-workout notes and failed-set marks. `finishWorkout({ bailed })` saves the record from the recorded completed sets.
- `src/hooks/usePhaseClock.ts` — `useWorkoutDriver()` (mounted once by WorkoutScreen) plays cues and expires phases, guarded by `phaseSeq`; `usePhaseRemaining()` / `usePhaseClock()` are what every timer display reads. A phase that ran out while the phone slept ends on wake; the next starts fresh.
- `src/lib/audio.ts` — Web Audio API singleton, lazy init. `initAudio()` must be called inside a user gesture (Start button) to unlock the AudioContext on Android. Cues never reject.
- `src/lib/haptics.ts` — `navigator.vibrate` is optional-chained → no-op on desktop.
- `src/lib/dates.ts` — local-calendar helpers (`toLocalDateString`, `parseDateKey`, `startOfWeek`, `formatDateKey`, …). Day keys are local `YYYY-MM-DD`: never derive them with `toISOString()` (UTC), and never parse them with `new Date("YYYY-MM-DD")` (UTC midnight → previous day west of UTC). DOM-free, so the SW uses it too.

### Large screens
`GymLogScreen` composes `src/components/gymlog/*` (type picker, fields, campus, freeform forms; pure helpers in `src/lib/gymForm.ts`). `SettingsScreen` composes `src/components/settings/*`. Put new sections in those folders rather than growing the screen file.

### Shared UI and hooks
- `src/components/ui.tsx` — `Pill`, `PillRow` (hidden scrollbar), `Segmented`, `IconToggle`. Use these instead of hand-rolled selected states.
- `ScreenHeader`, `EditorFooter` and `src/hooks/useEditor.ts` (`useEditor`, `useConfirmTap`) — every editor's header, save/delete footer, leave guard, double-submit guard and error display. A failed write keeps the screen open with an error.
- `src/hooks/useLoad.ts` — `useLoad(load, initial)` and `useHistoryData()`; drops results that arrive after unmount. Use it instead of a hand-written load effect.

### Persistence (IDB)
- `src/lib/db.ts` owns the connection (`getDB`, with `blocking` handling so a future upgrade isn't stuck behind an old tab), `getMeta`/`setMeta`, a generic `recordStore<T>(name)` that the domain modules wrap (`saveSession`, `saveClimb`, `saveNote`, …), and `replaceStores()` — one transaction for backup restore and Mountain Project refresh, so a bad record changes nothing.
- DB: `"hangboard-history"`, version 5. Add `oldVersion` branches in `upgrade` before the next schema change.
- Stores: `"sessions"` (workout records, including gym entries), `"climbs"` (route logs), `"notes"` (dated notes), `"schedules"` (planner days, `by-date` unique index), `"meta"` (device-local key/value, out-of-line keys — reminder config etc., **shared with the service worker**).
- Session index: `"by-start"` on `startedAt`.
- The SW reads `meta`/`schedules` via the raw IndexedDB API (no `idb` import). Reminder logic both sides share (keys, labels, `shouldFireReminder`) lives in `src/lib/reminderCore.ts`; the IDB key `reminder-last-fired` is the only "already fired today" record.
- Backups are validated per record (`validateBackup`) before anything is written.

### Workout types
- **Repeaters** (`workoutType: "repeaters"`) — Workout A, 2 sets of 7/6 reps, 7s hang / 3s rest.
- **Max Hang** (`workoutType: "max-hang"`) — Workout B, 3 sets × 1 rep, 10s hang, 5lb progressions.
- **Beginner** (`workoutType: "beginner"`) — single-set legacy.
- **Test** (`workoutType: "test"`) — short-timers state under `?test`; never saved.
- **Gym workout types**: `GYM_WORKOUT_TYPES` in `src/lib/history.ts` is the source of truth (`GymWorkoutType` derives from it). `src/lib/sessionKind.ts` (`isHangboardSession`, `sessionKind`) is the one way to classify a session; `src/lib/sessionSummary.ts` is the one summary text. Defined in `src/data/gymWorkouts.ts` with `fieldDefs` per type. `FieldType` supports `number | text | grade-v | grade-yds | select | multi-select`.

### Hold IDs (storage keys — never rename)
`jug, large-edge, mr-shallow, small-edge, imr-shallow, wide-pinch, sloper, med-pinch`

Max-hang hold IDs are separately prefixed (`b-chisel`, `b-hc`, `b-open`, etc.) and share no relation to the repeaters board.

### Progress screen
- `src/lib/progressData.ts` — `buildTrend`, `buildCalendar`, `calendarMonthLabels`, `computeStats` (pure).
- `src/lib/gradeTrends.ts` — `buildGradeTrend(climbs, "months"|"seasons"|"years")` for outdoor-sport route grade trend chart. Filters to `setting === "outdoor" && type === "sport"`, excludes attempts, returns SPORT_GRADES indices per style per bucket with empty buckets filled with nulls.
- `src/components/ProgressScreen.tsx` (orchestrator) + `src/components/progress/*` — sections: Overview calendar, Weight Trends (A/B + hold picker), Route Grades · Outdoor Sport (granularity + dual-handle range slider, 3 lines: onsight/flash/redpoint). Outer container is `h-dvh overflow-hidden` with an inner `overflow-y-auto` div — Playwright `fullPage: true` won't capture it; scroll the inner div manually.

## Test Mode and `?test` Query Param

**`?test` query param** — runtime gate, read **once at boot** into
   `IS_TEST_MODE` (`src/lib/testMode.ts`). The router drops the query string on
   the first navigation, so nothing may re-read `location.search` for this. It exposes `window.__store` and `window.__seedSyntheticClimbs` / `window.__clearSyntheticClimbs`. Selects an isolated **test workout** with 3 holds (`test-jug`, `test-large-edge`, `test-mr-shallow`; prep 3s, hang 2s, rest 2s — hang and rest are equal on purpose, a case that once froze the timer) so weights don't bleed into real data. The E2E suite runs this workout. Does **not** isolate the gym session DB — gym entries logged while in `?test` write to the real `hangboard-history` store; clean up by filtering on `gymData.type`.

### Ports

The E2E suite runs on **:5174** (`playwright.config.ts` starts its own
`npm run dev -- --port 5174`), so it doesn't collide with a dev server on :5173.
Run both at once. `reuseExistingServer` is on, so a stale server already on
:5174 gets reused; kill it with `fuser -k 5174/tcp` if tests act strangely.

### Debug seed helpers
- `window.__store` — raw Zustand store. `__store.getState()`, `__store.setState({...})`. Useful for jumping into specific phase states.
- `window.__seedSyntheticClimbs(scenario?)` — scenarios: `"default"`, `"wide"`, `"seasons"` (3 seasons × multiple grades — used for grade trend chart testing), `"attempts"`. All IDs prefixed `synthetic-`.
- `window.__clearSyntheticClimbs()` — only removes `synthetic-` prefixed records, never touches real climbs.
- Use these instead of inlining IDB writes via Playwright — easy to wipe real data otherwise.

## Visual design

The app used to look like stock Tailwind. These rules keep it from drifting back:

- **Font:** Archivo Variable (bundled via `@fontsource-variable`, so it works offline).
  Numbers that are the content, such as weights, grades, timers and counts, use the
  `font-num` utility in `src/index.css`. It gives a condensed, bold cut with tabular figures.
- **One accent:** `accent-*` (green, in `tailwind.config.js`) means "tap here", "selected" or
  "you are here". Selected pills are `bg-accent-500` with dark text.
  - Category colours (ARC orange, Cardio pink, …) only label types.
  - Red means danger, teal means warm-up, and yellow means bailed.
- **Headings** are sentence case. There are no all-caps eyebrow labels.
- **Lists** sit on one `rounded-2xl` surface with `divide-y` rows, not one card per item.
  Never put a card inside a card.
- **Disabled buttons** are gray, never a dimmed colour.
- **Screen headers** show a title and action icons, not a copy of the tab-bar icon.

## Conventions

- **Strict TS**: Recharts Tooltip `formatter` signature is `(v: number | undefined, name: string | undefined) => …` — `name` is `undefined`-able under strict mode.
- **Scrollable pill rows**: use `PillRow` (it hides the scrollbar). A visible scrollbar reads as a dark popup overlapping the pills.
- **Playwright MCP screenshots** live in `screenshots/` (gitignored). Never save to repo root.
- **Tests**: Vitest unit tests live alongside source under `src/lib/__tests__/`. Use `node` environment (set in `vitest.config.ts`); unit tests run in `America/Los_Angeles` (set in `vitest.config.ts`) so UTC date bugs show up — override with `TZ=…`.

## Service worker & background reminders

`vite.config.ts` uses vite-plugin-pwa in **`injectManifest`** mode with a custom SW at `src/sw.ts` (Vite/esbuild bundles it, which also sidesteps the old workbox-build terser worker-pool hang — no more `workbox.mode: "development"` needed). The SW:
- Precaches via `precacheAndRoute(self.__WB_MANIFEST)` — **reference that expression verbatim**; aliasing `self` erases workbox's injection marker and breaks the build.
- Handles `periodicsync` (tag `daily-reminder`) → `runDailyReminder()` reads `meta`/`schedules` from IDB and fires the daily notification. Periodic Background Sync is client-only and **approximate** (Chrome decides cadence, installed Android PWA only); the foreground `maybeFireDailyReminder` (`main.tsx`) is the catch-up path.
- Handles a `test-reminder` `postMessage` (Settings → "Send test notification") to fire immediately.

`src/sw.ts` is **excluded from `tsconfig.app.json`** and typechecked by its own `tsconfig.worker.json` (WebWorker lib). Keep it self-contained — no imports of app modules that pull DOM globals (`localStorage`, `Notification`). Periodic-sync types live in `src/types/periodic-sync.d.ts` (app + worker) and `src/sw-env.d.ts` (worker-only event types).

## Deploy

Vercel auto-detects Vite. Push to `main` (via `jj git push --bookmark main`) → auto-deploys.
