// Dev/test-only seeding helpers. Exposes:
//   window.__seedSyntheticClimbs("default" | "wide" | "seasons" | "attempts")
//   window.__clearSyntheticClimbs()
//   window.__seedSyntheticSchedule(weeks?)
//   window.__clearSyntheticSchedule()
//
// All seeded records use ids prefixed with `synthetic-` so the clear helper
// (and any other tooling) can safely remove them without touching real data.

import { addClimb, deleteClimb, getClimbs } from "./climbs";
import type { ClimbRecord } from "./climbs";
import type { ClimbStyle } from "../constants/climbGrades";
import { getDB } from "./history";
import {
  addDays,
  startOfWeek,
  toLocalDateString,
} from "./schedules";
import type { ScheduleDayType, ScheduleRecord } from "./schedules";

type Scenario = "default" | "wide" | "seasons" | "attempts";

type Seed = Omit<ClimbRecord, "id">;

const STYLES: ClimbStyle[] = ["onsight", "flash", "redpoint"];

function styleAt(i: number): ClimbStyle {
  return STYLES[i % STYLES.length];
}

function buildPyramidSeeds(
  date: string,
  spec: ReadonlyArray<readonly [grade: string, n: number]>,
  startIndex = 0,
): Seed[] {
  const out: Seed[] = [];
  let i = startIndex;
  for (const [grade, n] of spec) {
    for (let k = 0; k < n; k++) {
      const style = styleAt(k + i);
      out.push({
        route: `Route ${grade} #${k + 1}`,
        grade,
        location: "Red River Gorge",
        type: "sport",
        setting: "outdoor",
        style,
        climbs: style === "redpoint" ? 1 + (k % 4) : 1,
        date,
        notes: "",
      });
      i++;
    }
  }
  return out;
}

const SCENARIOS: Record<Scenario, () => Seed[]> = {
  // Moderate pyramid — good for verifying default auto-fit behavior.
  default: () =>
    buildPyramidSeeds("2026-05-01", [
      ["5.10a", 18],
      ["5.10b", 14],
      ["5.10c", 10],
      ["5.10d", 7],
      ["5.11a", 4],
      ["5.11b", 2],
      ["5.11c", 1],
    ]),

  // Very wide bottom row — exercises the fit-to-floor path and the
  // tap-grade-to-bloom expanded-row behavior.
  wide: () =>
    buildPyramidSeeds("2026-05-01", [
      ["5.10a", 35],
      ["5.10b", 26],
      ["5.10c", 18],
      ["5.10d", 12],
      ["5.11a", 7],
      ["5.11b", 4],
      ["5.11c", 2],
      ["5.11d", 1],
    ]),

  // Three seasons — exercises ScrollingPyramidsScreen with multiple cards.
  seasons: () => {
    const out: Seed[] = [];
    const seasons: Array<[date: string, mul: number]> = [
      ["2024-10-15", 1.0],
      ["2025-04-15", 0.8],
      ["2025-10-15", 1.2],
    ];
    const base: ReadonlyArray<readonly [string, number]> = [
      ["5.10a", 25],
      ["5.10b", 22],
      ["5.10c", 16],
      ["5.10d", 12],
      ["5.11a", 8],
      ["5.11b", 5],
      ["5.11c", 3],
      ["5.11d", 2],
      ["5.12a", 1],
    ];
    let i = 0;
    for (const [date, mul] of seasons) {
      const scaled = base.map(([g, n]) => [g, Math.round(n * mul)] as const);
      const part = buildPyramidSeeds(date, scaled, i);
      out.push(...part);
      i += part.length;
    }
    return out;
  },

  // A single route with attempts in one season and the eventual send in the
  // next — useful for exercising the per-window attempt-rollup logic.
  attempts: () => [
    {
      route: "Project X", grade: "5.12a", location: "Red River Gorge",
      type: "sport", setting: "outdoor", style: "attempt",
      climbs: 3, date: "2025-10-15", notes: "first burns",
    },
    {
      route: "Project X", grade: "5.12a", location: "Red River Gorge",
      type: "sport", setting: "outdoor", style: "attempt",
      climbs: 2, date: "2026-03-29", notes: "close",
    },
    {
      route: "Project X", grade: "5.12a", location: "Red River Gorge",
      type: "sport", setting: "outdoor", style: "redpoint",
      climbs: 3, date: "2026-04-04", notes: "send!",
    },
  ],
};

async function clearSynthetic(): Promise<number> {
  const all = await getClimbs();
  let deleted = 0;
  for (const c of all) {
    if (c.id.startsWith("synthetic-")) {
      await deleteClimb(c.id);
      deleted++;
    }
  }
  return deleted;
}

async function seed(scenario: Scenario = "default"): Promise<number> {
  const build = SCENARIOS[scenario];
  if (!build) {
    const names = Object.keys(SCENARIOS).join(", ");
    throw new Error(`Unknown scenario "${scenario}". Available: ${names}`);
  }
  await clearSynthetic();
  const seeds = build();
  for (let i = 0; i < seeds.length; i++) {
    await addClimb({ ...seeds[i], id: `synthetic-${scenario}-${i + 1}` });
  }
  // eslint-disable-next-line no-console
  console.log(`[devSeed] Seeded ${seeds.length} climbs (scenario: ${scenario})`);
  return seeds.length;
}

// ─── Schedule seeding ────────────────────────────────────────────────────────

const SAMPLE_WEEK: ScheduleDayType[] = [
  "power",
  "rest",
  "endurance",
  "rest",
  "hangboard",
  "outdoor",
  "outdoor",
];

async function clearSyntheticSchedule(): Promise<number> {
  const db = await getDB();
  const all = (await db.getAll("schedules")) as ScheduleRecord[];
  const tx = db.transaction("schedules", "readwrite");
  let deleted = 0;
  for (const s of all) {
    if (s.id.startsWith("synthetic-sched-")) {
      await tx.store.delete(s.id);
      deleted++;
    }
  }
  await tx.done;
  return deleted;
}

async function seedSyntheticSchedule(weeks = 2): Promise<number> {
  await clearSyntheticSchedule();
  const db = await getDB();
  const start = startOfWeek(new Date());
  const now = Date.now();
  const tx = db.transaction("schedules", "readwrite");
  let n = 0;
  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++) {
      const date = toLocalDateString(addDays(start, w * 7 + d));
      const existing = (await tx.store.index("by-date").get(date)) as ScheduleRecord | undefined;
      if (existing) await tx.store.delete(existing.id);
      const rec: ScheduleRecord = {
        id: `synthetic-sched-${date}`,
        date,
        dayType: SAMPLE_WEEK[d],
        createdAt: now,
        updatedAt: now,
      };
      await tx.store.put(rec);
      n++;
    }
  }
  await tx.done;
  // eslint-disable-next-line no-console
  console.log(`[devSeed] Seeded ${n} schedule entries (${weeks} weeks)`);
  return n;
}

if (
  typeof window !== "undefined" &&
  (import.meta.env.DEV || new URLSearchParams(window.location.search).has("test"))
) {
  const w = window as unknown as Record<string, unknown>;
  w.__seedSyntheticClimbs = seed;
  w.__clearSyntheticClimbs = clearSynthetic;
  w.__seedSyntheticSchedule = seedSyntheticSchedule;
  w.__clearSyntheticSchedule = clearSyntheticSchedule;
}
