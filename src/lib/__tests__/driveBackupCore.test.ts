import { describe, it, expect } from "vitest";
import {
  selectFilesToPrune,
  daysSince,
  isBackupStale,
  BACKUP_STALE_DAYS,
} from "../driveBackupCore";
import type { DriveFileMeta } from "../driveBackupCore";

const file = (id: string, name: string, createdTime: string): DriveFileMeta => ({
  id,
  name,
  createdTime,
});

describe("selectFilesToPrune", () => {
  const files = [
    file("a", "cairn-backup-2026-05-01.json", "2026-05-01T10:00:00Z"),
    file("b", "cairn-backup-2026-05-03.json", "2026-05-03T10:00:00Z"),
    file("c", "cairn-backup-2026-05-02.json", "2026-05-02T10:00:00Z"),
    file("d", "cairn-backup-2026-05-04.json", "2026-05-04T10:00:00Z"),
  ];

  it("keeps the newest N and returns the rest oldest-first", () => {
    // keep 2 newest (d, b) → prune c then a
    expect(selectFilesToPrune(files, 2)).toEqual(["c", "a"]);
  });

  it("returns nothing when under the limit", () => {
    expect(selectFilesToPrune(files, 10)).toEqual([]);
    expect(selectFilesToPrune(files, 4)).toEqual([]);
  });

  it("prunes everything when keep is 0", () => {
    expect(selectFilesToPrune(files, 0).sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("treats a negative keep as 0", () => {
    expect(selectFilesToPrune(files, -3).length).toBe(4);
  });

  it("breaks createdTime ties by name (newer date string wins)", () => {
    const tied = [
      file("x", "cairn-backup-2026-05-01.json", "2026-05-01T10:00:00Z"),
      file("y", "cairn-backup-2026-05-02.json", "2026-05-01T10:00:00Z"),
    ];
    // same createdTime → y (later name) kept, x pruned
    expect(selectFilesToPrune(tied, 1)).toEqual(["x"]);
  });

  it("does not mutate the input array", () => {
    const copy = [...files];
    selectFilesToPrune(files, 1);
    expect(files).toEqual(copy);
  });
});

describe("daysSince", () => {
  const now = new Date("2026-05-25T12:00:00Z").getTime();

  it("returns null when there has never been a backup", () => {
    expect(daysSince(null, now)).toBeNull();
  });

  it("floors the elapsed days", () => {
    const twoAndHalfDaysAgo = now - 2.5 * 86_400_000;
    expect(daysSince(twoAndHalfDaysAgo, now)).toBe(2);
  });

  it("clamps a future timestamp to 0", () => {
    expect(daysSince(now + 86_400_000, now)).toBe(0);
  });
});

describe("isBackupStale", () => {
  const now = new Date("2026-05-25T12:00:00Z").getTime();

  it("is stale when no backup exists", () => {
    expect(isBackupStale(null, now)).toBe(true);
  });

  it("is fresh just under the threshold", () => {
    const justUnder = now - (BACKUP_STALE_DAYS - 1) * 86_400_000;
    expect(isBackupStale(justUnder, now)).toBe(false);
  });

  it("is stale at or past the threshold", () => {
    const atThreshold = now - BACKUP_STALE_DAYS * 86_400_000;
    expect(isBackupStale(atThreshold, now)).toBe(true);
  });

  it("honors a custom threshold", () => {
    const threeDaysAgo = now - 3 * 86_400_000;
    expect(isBackupStale(threeDaysAgo, now, 2)).toBe(true);
    expect(isBackupStale(threeDaysAgo, now, 5)).toBe(false);
  });
});
