# Hangboard PWA — Claude Instructions

## Stack
Vite 7 + React 19 + TypeScript 5.9 + Tailwind 3 + Zustand 5 + vite-plugin-pwa + Playwright

## Dev Commands

```bash
npm run dev          # dev server on :5173 (normal timers: 7s hang, 3s rest, 180s break, 7 reps)
npm run build        # production build to dist/
npm run test:unit    # Vitest unit tests (~20 cases, <5s, no browser needed)
npx playwright test  # E2E tests (auto-starts dev server with VITE_TEST_MODE=true)
```

## Git Hooks

A pre-commit hook blocks commits that break the TypeScript build. It runs `npm run build` before every commit.

The hook lives at `scripts/pre-commit`. Install it once after cloning:

```bash
cp scripts/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

## Test Mode
`playwright.config.ts` sets `VITE_TEST_MODE=true` in the webServer command, which shortens:
- Timers: HANG=1s, REST=1s, BREAK=5s, PREP=1s
- Reps: SET1=3, SET2=2

**Critical gotcha**: `playwright.config.ts` uses `reuseExistingServer: true`. If `npm run dev` is already running on port 5173, Playwright will reuse it and tests will fail (full timers hit 60s timeout). Always kill any dev server before running tests:

```bash
fuser -k 5173/tcp
```

## Key Architecture

- `src/data/holds.ts` — HOLDS array, no Vite env, safe to import in tests/Node
- `src/data/workout.ts` — re-exports HOLDS + all test-aware constants (HANG_SECS, SET1_REPS, etc.)
- `src/store/useWorkoutStore.ts` — Zustand store; only `weights` persisted to localStorage
- `src/hooks/useTimer.ts` — setInterval-based timer
- `src/lib/audio.ts` — Web Audio API singleton, lazy init; must be called inside a user gesture

## Hold IDs (localStorage keys — never rename)
`jug, large-edge, mr-shallow, small-edge, imr-shallow, wide-pinch, sloper, med-pinch`

## Deploy
Push to Vercel — zero config, auto-detects Vite.
