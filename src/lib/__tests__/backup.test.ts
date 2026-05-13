import { describe, it, expect } from "vitest";
import { buildBackup, validateBackup, backupFilename } from "../backup";
import type { BackupFile } from "../backup";
import type { SessionRecord } from "../history";
import type { ClimbRecord } from "../climbs";

const SAMPLE_SESSION: SessionRecord = {
  id: "s1",
  workoutType: "repeaters",
  startedAt: 1000,
  completedAt: 2000,
  bailed: false,
  holds: [
    {
      holdId: "jug",
      holdName: "Jug",
      set1: { weight: 0, reps: 7, completed: true },
      set2: { weight: 0, reps: 6, completed: true },
    },
  ],
};

const SAMPLE_CLIMB: ClimbRecord = {
  id: "c1",
  route: "Pure Imagination",
  grade: "5.14c",
  location: "Red River Gorge",
  type: "sport",
  setting: "outdoor",
  style: "redpoint",
  climbs: 1,
  date: "2025-10-12",
  notes: "",
};

const FULL_INPUT = {
  sessions: [SAMPLE_SESSION],
  climbs: [SAMPLE_CLIMB],
  weights: { jug: { set1: 0, set2: 0 } },
  weightsB: { "b-hc": { set1: 50, set2: 55 } },
  selectedWorkout: "repeaters" as const,
  gymDefaults: { arc: { climbMin: "20" } },
  mountainProjectUrl: "https://example.com/user.csv",
  now: 1_700_000_000_000,
};

describe("buildBackup", () => {
  it("wraps inputs with metadata", () => {
    const f = buildBackup(FULL_INPUT);
    expect(f.app).toBe("hangboard");
    expect(f.version).toBe(1);
    expect(f.exportedAt).toBe(1_700_000_000_000);
    expect(f.data.sessions).toEqual([SAMPLE_SESSION]);
    expect(f.data.climbs).toEqual([SAMPLE_CLIMB]);
    expect(f.data.mountainProjectUrl).toBe("https://example.com/user.csv");
  });

  it("uses Date.now() when now is omitted", () => {
    const before = Date.now();
    const f = buildBackup({ ...FULL_INPUT, now: undefined });
    const after = Date.now();
    expect(f.exportedAt).toBeGreaterThanOrEqual(before);
    expect(f.exportedAt).toBeLessThanOrEqual(after);
  });
});

describe("validateBackup", () => {
  it("accepts a freshly built backup round-tripped through JSON", () => {
    const f = buildBackup(FULL_INPUT);
    const parsed = JSON.parse(JSON.stringify(f));
    const result = validateBackup(parsed);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.file.data.sessions).toEqual([SAMPLE_SESSION]);
      expect(result.file.data.climbs).toEqual([SAMPLE_CLIMB]);
    }
  });

  it("accepts an empty backup", () => {
    const f = buildBackup({
      sessions: [],
      climbs: [],
      weights: {},
      weightsB: {},
      selectedWorkout: "max-hang",
      gymDefaults: {},
      mountainProjectUrl: "",
      now: 0,
    });
    const result = validateBackup(JSON.parse(JSON.stringify(f)));
    expect(result.ok).toBe(true);
  });

  it("rejects null", () => {
    expect(validateBackup(null).ok).toBe(false);
  });

  it("rejects a non-hangboard file", () => {
    const r = validateBackup({ app: "other", version: 1, exportedAt: 0, data: {} });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Hangboard/i);
  });

  it("rejects an unsupported version", () => {
    const r = validateBackup({ app: "hangboard", version: 99, exportedAt: 0, data: {} });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/version/i);
  });

  it("rejects non-array sessions", () => {
    const bad = {
      app: "hangboard",
      version: 1,
      exportedAt: 0,
      data: {
        sessions: "nope",
        climbs: [],
        weights: {},
        weightsB: {},
        selectedWorkout: "repeaters",
        gymDefaults: {},
        mountainProjectUrl: "",
      },
    };
    const r = validateBackup(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/sessions/);
  });

  it("rejects an invalid selectedWorkout", () => {
    const f = buildBackup(FULL_INPUT) as BackupFile;
    const broken = JSON.parse(JSON.stringify(f));
    broken.data.selectedWorkout = "test";
    const r = validateBackup(broken);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/selectedWorkout/);
  });

  it("rejects a missing mountainProjectUrl", () => {
    const f = buildBackup(FULL_INPUT) as BackupFile;
    const broken = JSON.parse(JSON.stringify(f));
    delete broken.data.mountainProjectUrl;
    const r = validateBackup(broken);
    expect(r.ok).toBe(false);
  });
});

describe("backupFilename", () => {
  it("formats date as YYYY-MM-DD", () => {
    // 2026-05-12 in local time — construct via Date so test passes in any TZ
    const t = new Date(2026, 4, 12, 10, 30).getTime();
    expect(backupFilename(t)).toBe("hangboard-backup-2026-05-12.json");
  });

  it("zero-pads single-digit months and days", () => {
    const t = new Date(2026, 0, 3).getTime();
    expect(backupFilename(t)).toBe("hangboard-backup-2026-01-03.json");
  });
});
