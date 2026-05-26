import { useEffect, useRef, useState } from "react";
import {
  backupFilename,
  exportBackup,
  restoreBackup,
  validateBackup,
} from "../lib/backup";
import type { BackupFile } from "../lib/backup";
import { getSessions } from "../lib/history";
import { getClimbs } from "../lib/climbs";
import { getNotes } from "../lib/notes";
import {
  backupToDrive,
  disconnectDrive,
  getDriveState,
  isDriveConfigured,
  KEEP_DRIVE_BACKUPS,
} from "../lib/driveBackup";
import type { DriveBackupState } from "../lib/driveBackup";
import { daysSince } from "../lib/driveBackupCore";
import {
  getPrefs,
  periodicReminderStatus,
  permissionStatus,
  registerPeriodicReminder,
  requestPermission,
  sendTestNotification,
  setPrefs,
  unregisterPeriodicReminder,
} from "../lib/notifications";
import type { NotificationPrefs, PeriodicReminderSupport } from "../lib/notifications";
import { BackChevronIcon, GearIcon } from "./icons";

type Props = {
  onBack: () => void;
};

/** "today", "yesterday", "3 days ago" — for the last-Drive-backup line. */
function lastBackupLabel(lastBackupAt: number | null): string {
  if (lastBackupAt === null) return "never backed up to Drive";
  const days = daysSince(lastBackupAt, Date.now()) ?? 0;
  const when = days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
  return `last backed up ${when}`;
}

type RestorePending = {
  file: BackupFile;
  sessionCount: number;
  climbCount: number;
  noteCount: number;
  fileName: string;
};

export function SettingsScreen({ onBack }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [counts, setCounts] = useState<{ sessions: number; climbs: number; notes: number } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<RestorePending | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>(() => getPrefs());
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">(
    () => permissionStatus(),
  );
  const [bgStatus, setBgStatus] = useState<PeriodicReminderSupport>("unsupported");
  const [notifTest, setNotifTest] = useState<string | null>(null);
  const [driveState, setDriveState] = useState<DriveBackupState>(() => getDriveState());
  const [driveBusy, setDriveBusy] = useState(false);
  const [driveMsg, setDriveMsg] = useState<string | null>(null);
  const [driveErr, setDriveErr] = useState<string | null>(null);
  const driveConfigured = isDriveConfigured();

  useEffect(() => {
    Promise.all([getSessions(), getClimbs(), getNotes()])
      .then(([s, c, n]) => setCounts({ sessions: s.length, climbs: c.length, notes: n.length }))
      .catch(() => setCounts({ sessions: 0, climbs: 0, notes: 0 }));
  }, []);

  useEffect(() => {
    periodicReminderStatus().then(setBgStatus).catch(() => setBgStatus("unsupported"));
  }, []);

  const handleToggleNotif = async () => {
    if (notifPrefs.enabled) {
      setNotifPrefs(setPrefs({ enabled: false }));
      void unregisterPeriodicReminder();
      return;
    }
    if (notifPermission !== "granted") {
      const result = await requestPermission();
      setNotifPermission(result);
      if (result !== "granted") return;
    }
    setNotifPrefs(setPrefs({ enabled: true }));
    await registerPeriodicReminder();
    setBgStatus(await periodicReminderStatus());
  };

  const handleTimeChange = (time: string) => {
    setNotifPrefs(setPrefs({ time }));
  };

  const handleTestNotif = async () => {
    if (notifPermission !== "granted") {
      const result = await requestPermission();
      setNotifPermission(result);
      if (result !== "granted") return;
    }
    const ok = await sendTestNotification();
    setNotifTest(ok ? "Sent — check your notifications." : "Couldn't send a test notification.");
  };

  const clearMessages = () => {
    setStatus(null);
    setError(null);
  };

  const handleDriveBackup = async () => {
    setDriveBusy(true);
    setDriveMsg(null);
    setDriveErr(null);
    try {
      const { fileName, pruned } = await backupToDrive(true);
      setDriveState(getDriveState());
      setDriveMsg(
        pruned > 0
          ? `Uploaded ${fileName}. Pruned ${pruned} old backup${pruned === 1 ? "" : "s"}.`
          : `Uploaded ${fileName} to Drive.`,
      );
    } catch (err) {
      setDriveErr(err instanceof Error ? err.message : String(err));
    } finally {
      setDriveBusy(false);
    }
  };

  const handleDriveDisconnect = () => {
    disconnectDrive();
    setDriveState(getDriveState());
    setDriveMsg(null);
    setDriveErr(null);
  };

  const handleBackup = async () => {
    clearMessages();
    try {
      const file = await exportBackup();
      const json = JSON.stringify(file, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = backupFilename(file.exportedAt);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus(
        `Downloaded ${a.download} — ${file.data.sessions.length} sessions, ${file.data.climbs.length} climbs, ${file.data.notes.length} notes.`
      );
    } catch (err) {
      setError(`Backup failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    clearMessages();
    setPending(null);
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        setError("File is not valid JSON.");
        return;
      }
      const result = validateBackup(parsed);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPending({
        file: result.file,
        sessionCount: result.file.data.sessions.length,
        climbCount: result.file.data.climbs.length,
        noteCount: result.file.data.notes.length,
        fileName: file.name,
      });
    } catch (err) {
      setError(`Could not read file: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const confirmRestore = async () => {
    if (!pending) return;
    setRestoring(true);
    clearMessages();
    try {
      await restoreBackup(pending.file);
      // Reload so Zustand rehydrates cleanly and every screen picks up the new IDB state.
      window.location.reload();
    } catch (err) {
      setRestoring(false);
      setError(`Restore failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="h-dvh bg-gray-900 flex flex-col">
      <header className="bg-gray-800 px-4 pt-4 pb-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-white transition-colors p-1 -ml-1"
          aria-label="Back"
        >
          <BackChevronIcon />
        </button>
        <GearIcon className="text-white" aria-label="Settings" />
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-6">
        <section className="bg-gray-800 rounded-xl p-4 flex flex-col gap-3">
          <h2 className="text-white font-semibold text-base">Backup &amp; Restore</h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            Your workouts, climbs, weights, and settings live only in this browser. Export a JSON
            file you can re-import here later or on another device.
          </p>

          {counts && (
            <p className="text-gray-500 text-xs">
              Current: {counts.sessions} session{counts.sessions === 1 ? "" : "s"} ·{" "}
              {counts.climbs} climb{counts.climbs === 1 ? "" : "s"} ·{" "}
              {counts.notes} note{counts.notes === 1 ? "" : "s"}
            </p>
          )}

          <div className="flex flex-col gap-2 pt-1">
            <button
              onClick={handleBackup}
              disabled={restoring}
              className="w-full py-3 rounded-xl bg-green-600 active:bg-green-500 disabled:opacity-50 text-white font-semibold text-base"
              data-testid="settings-backup"
            >
              Download backup
            </button>
            <button
              onClick={() => {
                clearMessages();
                setPending(null);
                fileInputRef.current?.click();
              }}
              disabled={restoring}
              className="w-full py-3 rounded-xl bg-gray-700 active:bg-gray-600 disabled:opacity-50 text-white font-semibold text-base"
              data-testid="settings-restore"
            >
              Restore from file…
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleFile}
              className="hidden"
            />
          </div>

          {status && (
            <p className="text-green-400 text-sm" data-testid="settings-status">{status}</p>
          )}
          {error && (
            <p className="text-red-400 text-sm" data-testid="settings-error">{error}</p>
          )}
        </section>

        <section className="bg-gray-800 rounded-xl p-4 flex flex-col gap-3" data-testid="settings-drive">
          <h2 className="text-white font-semibold text-base">Cloud backup · Google Drive</h2>
          {!driveConfigured ? (
            <p className="text-gray-400 text-sm leading-relaxed">
              Not configured for this build. To enable one-tap backup to Drive,
              set <span className="font-mono text-gray-300">VITE_GOOGLE_CLIENT_ID</span> to a
              Google OAuth client ID (Web application, with this site as an
              authorized JavaScript origin) and redeploy.
            </p>
          ) : (
            <>
              <p className="text-gray-400 text-sm leading-relaxed">
                Upload a full backup to a private Drive folder only Cairn can
                see. Keeps the last {KEEP_DRIVE_BACKUPS} and prunes older ones.
                Tap to back up — browsers can&apos;t upload on a schedule, so
                you&apos;ll get a nudge when it&apos;s been a while.
              </p>
              <p className="text-gray-500 text-xs" data-testid="settings-drive-status">
                {lastBackupLabel(driveState.lastBackupAt)}
                {driveState.lastFileName ? ` · ${driveState.lastFileName}` : ""}
              </p>
              <div className="flex flex-col gap-2 pt-1">
                <button
                  onClick={handleDriveBackup}
                  disabled={driveBusy || restoring}
                  className="w-full py-3 rounded-xl bg-blue-600 active:bg-blue-500 disabled:opacity-50 text-white font-semibold text-base"
                  data-testid="settings-drive-backup"
                >
                  {driveBusy ? "Backing up…" : "Back up to Drive"}
                </button>
                {driveState.connected && (
                  <button
                    onClick={handleDriveDisconnect}
                    disabled={driveBusy}
                    className="self-start px-3 py-1.5 rounded-lg bg-gray-700 active:bg-gray-600 disabled:opacity-40 text-white text-xs font-semibold"
                  >
                    Disconnect Drive
                  </button>
                )}
              </div>
              {driveMsg && (
                <p className="text-green-400 text-sm" data-testid="settings-drive-msg">{driveMsg}</p>
              )}
              {driveErr && (
                <p className="text-red-400 text-sm" data-testid="settings-drive-err">{driveErr}</p>
              )}
            </>
          )}
        </section>

        <section className="bg-gray-800 rounded-xl p-4 flex flex-col gap-3" data-testid="settings-notifications">
          <h2 className="text-white font-semibold text-base">Daily reminder</h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            Notification when today has a planned workout, once per day at or
            after your chosen time. Fires on app open, and — on an installed
            Android PWA — in the background too.
          </p>
          <label className="flex items-center justify-between gap-3">
            <span className="text-white text-sm">Enable</span>
            <input
              type="checkbox"
              checked={notifPrefs.enabled}
              onChange={handleToggleNotif}
              disabled={notifPermission === "unsupported"}
              className="w-5 h-5 accent-green-600"
              data-testid="settings-notif-toggle"
            />
          </label>
          <label className="flex items-center justify-between gap-3">
            <span className="text-white text-sm">Time</span>
            <input
              type="time"
              value={notifPrefs.time}
              onChange={(e) => handleTimeChange(e.target.value)}
              className="bg-gray-700 text-white rounded px-2 py-1 text-sm"
              data-testid="settings-notif-time"
            />
          </label>
          <button
            onClick={handleTestNotif}
            disabled={notifPermission === "unsupported"}
            className="self-start px-3 py-1.5 rounded-lg bg-gray-700 active:bg-gray-600 disabled:opacity-40 text-white text-xs font-semibold"
            data-testid="settings-notif-test"
          >
            Send test notification
          </button>
          {notifTest && (
            <p className="text-gray-400 text-xs" data-testid="settings-notif-test-status">
              {notifTest}
            </p>
          )}
          {notifPermission === "denied" && (
            <p className="text-amber-400 text-xs">
              Browser notifications are blocked — enable them in your browser or
              OS settings to receive reminders.
            </p>
          )}
          {notifPermission === "unsupported" && (
            <p className="text-amber-400 text-xs">
              This browser doesn&apos;t support notifications.
            </p>
          )}
          {notifPrefs.enabled && bgStatus === "granted" && (
            <p className="text-gray-500 text-xs leading-relaxed">
              Background reminders are on. Timing is approximate — Android
              decides when to wake the app (roughly daily), so the alert may
              arrive a while after your set time.
            </p>
          )}
          {notifPrefs.enabled && bgStatus !== "granted" && (
            <p className="text-gray-500 text-xs leading-relaxed">
              Background delivery isn&apos;t available here, so reminders fire
              on the next app open. Install Cairn to your Android home screen
              and use it a few times to enable closed-app reminders.
            </p>
          )}
        </section>

        {pending && (
          <section className="bg-red-950/40 border border-red-700/60 rounded-xl p-4 flex flex-col gap-3">
            <h3 className="text-red-200 font-semibold text-base">Confirm restore</h3>
            <p className="text-red-100 text-sm leading-relaxed">
              This will <strong>replace</strong> everything currently stored on this device with
              the contents of <span className="font-mono">{pending.fileName}</span>:
              {" "}{pending.sessionCount} session{pending.sessionCount === 1 ? "" : "s"},{" "}
              {pending.climbCount} climb{pending.climbCount === 1 ? "" : "s"}, and{" "}
              {pending.noteCount} note{pending.noteCount === 1 ? "" : "s"}.
            </p>
            <p className="text-red-200 text-xs">
              Tip: download a backup of your current data first if you might want it back.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setPending(null)}
                disabled={restoring}
                className="flex-1 py-2.5 rounded-xl bg-gray-700 active:bg-gray-600 disabled:opacity-50 text-white font-semibold text-sm"
              >
                Cancel
              </button>
              <button
                onClick={confirmRestore}
                disabled={restoring}
                className="flex-1 py-2.5 rounded-xl bg-red-600 active:bg-red-500 disabled:opacity-50 text-white font-semibold text-sm"
                data-testid="settings-confirm-restore"
              >
                {restoring ? "Restoring…" : "Replace everything"}
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
