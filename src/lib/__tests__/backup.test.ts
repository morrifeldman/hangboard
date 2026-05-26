import { describe, it, expect } from "vitest";
import { buildBackup, validateBackup, backupFilename } from "../backup";
import type { BackupFile } from "../backup";
import type { SessionRecord } from "../history";
import type { ClimbRecord } from "../climbs";
import type { ScheduleRecord } from "../schedules";
import type { NoteRecord } from "../notes";

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

const SAMPLE_SCHEDULE: ScheduleRecord = {
  id: "sch1",
  date: "2026-05-21",
  dayTypes: ["power", "stretching"],
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
};

const SAMPLE_NOTE: NoteRecord = {
  id: "n1",
  date: "2026-05-20",
  text: "Tweaked A2 pulley on left ring finger — taking a week off crimps.",
  category: "injury",
  createdAt: 1_700_000_000_000,
};

const FULL_INPUT = {
  sessions: [SAMPLE_SESSION],
  climbs: [SAMPLE_CLIMB],
  schedules: [SAMPLE_SCHEDULE],
  notes: [SAMPLE_NOTE],
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
      schedules: [],
      notes: [],
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

  it("round-trips schedules", () => {
    const f = buildBackup(FULL_INPUT);
    const parsed = JSON.parse(JSON.stringify(f));
    const result = validateBackup(parsed);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.file.data.schedules).toEqual([SAMPLE_SCHEDULE]);
  });

  it("treats a missing schedules field as an empty array (legacy backups)", () => {
    const f = buildBackup(FULL_INPUT);
    const parsed = JSON.parse(JSON.stringify(f));
    delete parsed.data.schedules;
    const result = validateBackup(parsed);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.file.data.schedules).toEqual([]);
  });

  it("rejects a non-array schedules field", () => {
    const f = buildBackup(FULL_INPUT);
    const parsed = JSON.parse(JSON.stringify(f));
    parsed.data.schedules = "nope";
    const result = validateBackup(parsed);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/schedules/);
  });

  it("round-trips notes", () => {
    const f = buildBackup(FULL_INPUT);
    const parsed = JSON.parse(JSON.stringify(f));
    const result = validateBackup(parsed);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.file.data.notes).toEqual([SAMPLE_NOTE]);
  });

  it("treats a missing notes field as an empty array (legacy backups)", () => {
    const f = buildBackup(FULL_INPUT);
    const parsed = JSON.parse(JSON.stringify(f));
    delete parsed.data.notes;
    const result = validateBackup(parsed);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.file.data.notes).toEqual([]);
  });

  it("rejects a non-array notes field", () => {
    const f = buildBackup(FULL_INPUT);
    const parsed = JSON.parse(JSON.stringify(f));
    parsed.data.notes = "nope";
    const result = validateBackup(parsed);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/notes/);
  });

  it("rejects null", () => {
    expect(validateBackup(null).ok).toBe(false);
  });

  it("rejects a non-hangboard file", () => {
    const r = validateBackup({ app: "other", version: 1, exportedAt: 0, data: {} });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Cairn/i);
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
    expect(backupFilename(t)).toBe("cairn-backup-2026-05-12.json");
  });

  it("zero-pads single-digit months and days", () => {
    const t = new Date(2026, 0, 3).getTime();
    expect(backupFilename(t)).toBe("cairn-backup-2026-01-03.json");
  });
});
