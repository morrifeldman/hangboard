# Hangboard Trainer

A PWA for structured hangboard training with timer-driven workouts, weight tracking, session history, progress graphs, and a climbing pyramid tracker.

## Features

- **Timed workouts** -- Repeaters (Workout A) and Max Hangs (Workout B) with configurable hold sequences, automatic set/rep/break progression, and audio/haptic cues
- **Weight tracking** -- Per-hold, per-set weight adjustments persisted across sessions
- **Session history** -- Every completed workout is logged to IndexedDB with per-hold details, notes, and pass/fail tracking
- **Progress charts** -- 12-week calendar heatmap and per-hold weight trend lines
- **Gym workout logging** -- Log non-hangboard sessions (ARC, CIR, bouldering, routes, etc.)
- **Climbing pyramid** -- Pyramid and timeline visualizations for outdoor/indoor sport and boulder sends, with Mountain Project CSV import
- **Installable PWA** -- Works offline, installable on Android/iOS

## Getting Started

```bash
npm install
npm run dev        # dev server on http://localhost:5173
```

## Other Commands

```bash
npm run build              # production build
npm run test:unit          # Vitest unit tests
fuser -k 5173/tcp         # kill dev server before running E2E
npx playwright test        # Playwright E2E tests
```

## Stack

Vite + React + TypeScript + Tailwind CSS + Zustand + IndexedDB + Recharts + vite-plugin-pwa

## Deploy

Push to Vercel -- zero config, auto-detects Vite. The `api/` directory contains a serverless function for Mountain Project CSV imports.
