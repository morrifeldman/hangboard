// Google Drive auto-backup: one-tap upload to the hidden appDataFolder, with a
// rolling window of dated backups. Browser PWAs can't do unattended scheduled
// uploads (no refresh tokens in the GIS token flow, no reliable background
// hook), so "auto" here means one-tap + a staleness nudge — see ProgressScreen
// / SettingsScreen. Pure prune/staleness logic lives in `driveBackupCore.ts`.

import { exportBackup, backupFilename } from "./backup";
import { selectFilesToPrune } from "./driveBackupCore";
import type { DriveFileMeta } from "./driveBackupCore";

// drive.appdata: a per-app hidden folder. Cairn can't see any of your other
// Drive files with this scope, which keeps the consent prompt unintimidating.
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const GIS_SRC = "https://accounts.google.com/gsi/client";

/** How many dated backups to retain in Drive before pruning the oldest. */
export const KEEP_DRIVE_BACKUPS = 10;

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

/** localStorage record of the last successful Drive backup, for the nudge. */
const DRIVE_STATE_KEY = "cairn-drive-backup";

export type DriveBackupState = {
  lastBackupAt: number | null;
  lastFileName: string | null;
  // Sticky once the user has connected, so we can attempt a silent token grant.
  connected: boolean;
};

const DEFAULT_STATE: DriveBackupState = {
  lastBackupAt: null,
  lastFileName: null,
  connected: false,
};

export function getDriveState(): DriveBackupState {
  if (typeof localStorage === "undefined") return { ...DEFAULT_STATE };
  try {
    const raw = localStorage.getItem(DRIVE_STATE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const p = JSON.parse(raw) as Partial<DriveBackupState>;
    return {
      lastBackupAt: typeof p.lastBackupAt === "number" ? p.lastBackupAt : null,
      lastFileName: typeof p.lastFileName === "string" ? p.lastFileName : null,
      connected: p.connected === true,
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function setDriveState(patch: Partial<DriveBackupState>): DriveBackupState {
  const next = { ...getDriveState(), ...patch };
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(DRIVE_STATE_KEY, JSON.stringify(next));
  }
  return next;
}

/** Whether a Google OAuth client id was provided at build time. */
export function isDriveConfigured(): boolean {
  return typeof CLIENT_ID === "string" && CLIENT_ID.length > 0;
}

// ── GIS token acquisition ───────────────────────────────────────────────────

let gisScriptPromise: Promise<void> | null = null;

function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisScriptPromise) return gisScriptPromise;
  gisScriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => {
      gisScriptPromise = null;
      reject(new Error("Could not load Google sign-in. Check your connection."));
    };
    document.head.appendChild(s);
  });
  return gisScriptPromise;
}

let cachedToken: { value: string; expiresAt: number } | null = null;
let tokenClient: TokenClient | null = null;

/**
 * Get a usable Drive access token. Reuses a cached one until ~1 min before it
 * expires. `interactive` controls whether a consent popup may appear — pass
 * false to attempt a silent grant (only succeeds if the user consented before).
 */
async function getAccessToken(interactive: boolean): Promise<string> {
  if (!isDriveConfigured()) {
    throw new Error("Drive backup isn't configured (missing VITE_GOOGLE_CLIENT_ID).");
  }
  if (cachedToken && cachedToken.expiresAt - 60_000 > Date.now()) {
    return cachedToken.value;
  }
  await loadGis();
  const oauth2 = window.google?.accounts.oauth2;
  if (!oauth2) throw new Error("Google sign-in unavailable.");

  return new Promise<string>((resolve, reject) => {
    tokenClient = oauth2.initTokenClient({
      client_id: CLIENT_ID as string,
      scope: DRIVE_SCOPE,
      prompt: interactive ? "" : "none",
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error_description || resp.error || "Authorization failed."));
          return;
        }
        const ttl = (resp.expires_in ?? 3600) * 1000;
        cachedToken = { value: resp.access_token, expiresAt: Date.now() + ttl };
        setDriveState({ connected: true });
        resolve(resp.access_token);
      },
      error_callback: (err) => {
        reject(new Error(err.message || "Authorization was dismissed."));
      },
    });
    tokenClient.requestAccessToken({ prompt: interactive ? "" : "none" });
  });
}

// ── Drive REST calls ─────────────────────────────────────────────────────────

async function driveFetch(token: string, url: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    // Token went stale mid-flight; drop it so the next attempt re-auths.
    cachedToken = null;
  }
  if (!res.ok) {
    throw new Error(`Drive request failed (${res.status}).`);
  }
  return res;
}

async function listBackups(token: string): Promise<DriveFileMeta[]> {
  const url =
    "https://www.googleapis.com/drive/v3/files" +
    "?spaces=appDataFolder&fields=files(id,name,createdTime)" +
    "&orderBy=createdTime desc&pageSize=100";
  const res = await driveFetch(token, url);
  const json = (await res.json()) as { files?: DriveFileMeta[] };
  return json.files ?? [];
}

async function uploadBackup(token: string, name: string, body: string): Promise<void> {
  const boundary = "cairn-" + Math.random().toString(36).slice(2);
  const metadata = { name, parents: ["appDataFolder"], mimeType: "application/json" };
  const multipart =
    `--${boundary}\r\n` +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    "Content-Type: application/json\r\n\r\n" +
    `${body}\r\n` +
    `--${boundary}--`;
  await driveFetch(
    token,
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body: multipart,
    },
  );
}

async function deleteFile(token: string, id: string): Promise<void> {
  await driveFetch(token, `https://www.googleapis.com/drive/v3/files/${id}`, {
    method: "DELETE",
  });
}

// ── Public actions ────────────────────────────────────────────────────────────

export type BackupToDriveResult = { fileName: string; pruned: number };

/**
 * Export the full backup and upload it to Drive, then prune to the rolling
 * window. `interactive` should be true when triggered by a user tap (consent
 * popup allowed) and false for silent attempts.
 */
export async function backupToDrive(interactive = true): Promise<BackupToDriveResult> {
  const token = await getAccessToken(interactive);
  const file = await exportBackup();
  const name = backupFilename(file.exportedAt);
  await uploadBackup(token, name, JSON.stringify(file));

  let pruned = 0;
  try {
    const files = await listBackups(token);
    const toDelete = selectFilesToPrune(files, KEEP_DRIVE_BACKUPS);
    for (const id of toDelete) {
      await deleteFile(token, id);
      pruned += 1;
    }
  } catch {
    // Pruning is best-effort — a successful upload still counts as a backup.
  }

  setDriveState({ lastBackupAt: file.exportedAt, lastFileName: name, connected: true });
  return { fileName: name, pruned };
}

/** Forget the local connection and revoke the in-memory token. */
export function disconnectDrive(): void {
  if (cachedToken && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(cachedToken.value);
  }
  cachedToken = null;
  tokenClient = null;
  setDriveState({ connected: false });
}
