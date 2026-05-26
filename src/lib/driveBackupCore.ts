// Pure helpers for the Drive auto-backup feature. No env, DOM, or network
// imports here so the logic stays unit-testable in the Node/vitest env — all
// the GIS/Drive REST side effects live in `driveBackup.ts`.

/** Minimal shape of a Drive file as returned by the files.list endpoint. */
export type DriveFileMeta = {
  id: string;
  name: string;
  createdTime: string; // RFC 3339 timestamp
};

/**
 * Given the backups currently in Drive and how many to keep, return the ids of
 * the oldest ones to delete. Newest-first by createdTime; ties broken by name
 * (our filenames embed the date, so this is stable). Keeps at most `keep`.
 */
export function selectFilesToPrune(files: DriveFileMeta[], keep: number): string[] {
  if (keep < 0) keep = 0;
  const sorted = [...files].sort((a, b) => {
    if (a.createdTime !== b.createdTime) return a.createdTime < b.createdTime ? 1 : -1;
    return a.name < b.name ? 1 : -1;
  });
  return sorted.slice(keep).map((f) => f.id);
}

/** How many days old the most recent backup is, or null if there's never been one. */
export function daysSince(lastBackupAt: number | null, now: number): number | null {
  if (lastBackupAt === null) return null;
  const ms = now - lastBackupAt;
  if (ms < 0) return 0;
  return Math.floor(ms / 86_400_000);
}

/** Default age (days) past which we nudge the user to back up again. */
export const BACKUP_STALE_DAYS = 7;

/**
 * True when the user should be nudged to back up: either they never have, or
 * the last backup is older than the threshold.
 */
export function isBackupStale(
  lastBackupAt: number | null,
  now: number,
  thresholdDays: number = BACKUP_STALE_DAYS,
): boolean {
  if (lastBackupAt === null) return true;
  const days = daysSince(lastBackupAt, now);
  return days !== null && days >= thresholdDays;
}
