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
  clearMountainProjectUrl,
  getMountainProjectUrl,
  importClimbsFromFile,
  refreshFromMountainProject,
} from "../lib/mpRefresh";
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
import { BackChevronIcon } from "./icons";
import { LeaveGuardSheet } from "./LeaveGuardSheet";
import { useLeaveGuard } from "../hooks/useLeaveGuard";

type Props = {
  onBack: () => void;
};

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
  const mpFileInputRef = useRef<HTMLInputElement>(null);
  const [mpUrl, setMpUrl] = useState(() => getMountainProjectUrl());
  // The URL is only stored once an import with it succeeds.
  const [savedMpUrl, setSavedMpUrl] = useState(mpUrl);
  const leaveGuard = useLeaveGuard(mpUrl.trim() !== savedMpUrl);
  const [mpBusy, setMpBusy] = useState(false);
  const [mpStatus, setMpStatus] = useState<string | null>(null);
  const [mpError, setMpError] = useState<string | null>(null);

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
      // The restore replaced the stored link too, so a half-typed one is moot.
      leaveGuard.allowLeave();
      window.location.reload();
    } catch (err) {
      setRestoring(false);
      setError(`Restore failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Keep the "Current: … climbs" line honest after an import replaces them.
  const refreshClimbCount = async () => {
    try {
      const climbs = await getClimbs();
      setCounts((c) => (c ? { ...c, climbs: climbs.length } : c));
    } catch {
      // A stale count is harmless; the import itself already succeeded.
    }
  };

  const handleMpRefresh = async () => {
    setMpStatus(null);
    setMpError(null);
    setMpBusy(true);
    try {
      const count = await refreshFromMountainProject(mpUrl);
      setMpUrl(mpUrl.trim());
      setSavedMpUrl(mpUrl.trim());
      setMpStatus(`Imported ${count} climb${count === 1 ? "" : "s"}.`);
      await refreshClimbCount();
    } catch (err) {
      setMpError(
        `Import failed: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setMpBusy(false);
    }
  };

  const handleMpClear = () => {
    clearMountainProjectUrl();
    setMpUrl("");
    setSavedMpUrl("");
    setMpStatus(null);
    setMpError(null);
  };

  const handleMpFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setMpStatus(null);
    setMpError(null);
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setMpBusy(true);
    try {
      const count = await importClimbsFromFile(file);
      setMpStatus(`Imported ${count} climb${count === 1 ? "" : "s"}.`);
      await refreshClimbCount();
    } catch (err) {
      setMpError(
        `Import failed: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setMpBusy(false);
    }
  };

  return (
    <div className="h-full bg-gray-900 flex flex-col">
      <header className="bg-gray-800 px-4 pt-4 pb-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-white transition-colors p-1 -ml-1"
          aria-label="Back"
        >
          <BackChevronIcon />
        </button>
        <h1 className="text-white font-bold text-lg">Settings</h1>
      </header>

      <main className="flex-1 overflow-y-auto px-4 pb-8 flex flex-col divide-y divide-gray-800">
        <section className="py-6 flex flex-col gap-3">
          <h2 className="text-white font-semibold text-base">Backup and restore</h2>
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
              className="w-full py-3 rounded-lg bg-accent-500 active:bg-accent-400 disabled:bg-gray-700 disabled:text-gray-500 text-gray-900 font-semibold text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-300"
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
              className="w-full py-3 rounded-lg bg-gray-800 active:bg-gray-700 border border-gray-700 disabled:text-gray-600 disabled:border-gray-800 text-gray-200 font-semibold text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
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
            <p className="text-accent-300 text-sm" data-testid="settings-status">{status}</p>
          )}
          {error && (
            <p className="text-red-400 text-sm" data-testid="settings-error">{error}</p>
          )}
          {pending && (
            <div className="bg-red-950/40 border border-red-700/60 rounded-2xl p-4 flex flex-col gap-3">
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
                  className="flex-1 py-3 rounded-lg bg-gray-700 active:bg-gray-600 disabled:text-gray-500 text-white font-semibold text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmRestore}
                  disabled={restoring}
                  className="flex-1 py-3 rounded-lg bg-red-600 active:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold text-sm"
                  data-testid="settings-confirm-restore"
                >
                  {restoring ? "Restoring…" : "Replace everything"}
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="py-6 flex flex-col gap-3" data-testid="settings-mountain-project">
          <h2 className="text-white font-semibold text-base">Mountain Project</h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            Pull your ticks in from Mountain Project. Every import{" "}
            <strong className="text-gray-300">replaces all stored climbs</strong> with
            what the export contains.
          </p>
          <ol className="text-gray-500 text-xs leading-relaxed list-decimal list-inside">
            <li>Mountain Project &rarr; Profile &rarr; Ticks</li>
            <li>Make your ticks public</li>
            <li>Copy the &ldquo;Export CSV&rdquo; URL and paste it below</li>
          </ol>

          <input
            type="url"
            value={mpUrl}
            onChange={(e) => setMpUrl(e.target.value)}
            placeholder="https://www.mountainproject.com/user/.../tick-export"
            className="w-full h-10 px-3 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-accent-500/60"
            data-testid="settings-mp-url"
          />

          <div className="flex flex-col gap-2 pt-1">
            <button
              onClick={handleMpRefresh}
              disabled={mpBusy || !mpUrl.trim()}
              className="w-full py-3 rounded-lg bg-accent-500 active:bg-accent-400 disabled:bg-gray-700 disabled:text-gray-500 text-gray-900 font-semibold text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-300 flex items-center justify-center gap-2"
              data-testid="settings-mp-refresh"
            >
              {mpBusy && (
                <svg
                  className="animate-spin h-4 w-4 flex-shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              )}
              {mpBusy ? "Refreshing…" : "Refresh from Mountain Project"}
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => mpFileInputRef.current?.click()}
                disabled={mpBusy}
                className="flex-1 py-3 rounded-lg bg-gray-800 active:bg-gray-700 border border-gray-700 disabled:text-gray-600 disabled:border-gray-800 text-gray-200 font-semibold text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
                data-testid="settings-mp-file"
              >
                Upload CSV…
              </button>
              <button
                onClick={handleMpClear}
                disabled={mpBusy || !mpUrl}
                className="px-5 py-3 rounded-lg bg-gray-800 active:bg-gray-700 border border-gray-700 disabled:text-gray-600 disabled:border-gray-800 text-gray-200 font-semibold text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
                data-testid="settings-mp-clear"
              >
                Clear
              </button>
            </div>
            <input
              ref={mpFileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleMpFile}
              className="hidden"
            />
          </div>

          {mpStatus && (
            <p className="text-accent-300 text-sm" data-testid="settings-mp-status">{mpStatus}</p>
          )}
          {mpError && (
            <p className="text-red-400 text-sm" data-testid="settings-mp-error">{mpError}</p>
          )}
        </section>

        <section className="py-6 flex flex-col gap-3" data-testid="settings-notifications">
          <h2 className="text-white font-semibold text-base">Daily reminder</h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            Get one notification on days with a planned workout, at or after
            the time you choose.
          </p>
          <label className="flex min-h-10 items-center justify-between gap-3">
            <span className="text-white text-sm">Enable</span>
            <input
              type="checkbox"
              role="switch"
              checked={notifPrefs.enabled}
              onChange={handleToggleNotif}
              disabled={notifPermission === "unsupported"}
              className="relative h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full bg-gray-600 transition-colors checked:bg-accent-500 disabled:cursor-default disabled:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 before:absolute before:left-0.5 before:top-0.5 before:h-5 before:w-5 before:rounded-full before:bg-white before:transition-transform before:content-[''] checked:before:translate-x-5 disabled:before:bg-gray-500 motion-reduce:before:transition-none"
              data-testid="settings-notif-toggle"
            />
          </label>
          <label className="flex min-h-10 items-center justify-between gap-3">
            <span className="text-white text-sm">Time</span>
            <input
              type="time"
              value={notifPrefs.time}
              onChange={(e) => handleTimeChange(e.target.value)}
              className="h-10 px-3 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm [color-scheme:dark] focus:outline-none focus:border-accent-500/60"
              data-testid="settings-notif-time"
            />
          </label>
          <button
            onClick={handleTestNotif}
            disabled={notifPermission === "unsupported"}
            className="self-start px-4 py-2.5 rounded-lg bg-gray-800 active:bg-gray-700 border border-gray-700 disabled:text-gray-600 disabled:border-gray-800 text-gray-200 font-semibold text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
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
              Notifications are blocked. Allow them in your browser or phone
              settings to get reminders.
            </p>
          )}
          {notifPermission === "unsupported" && (
            <p className="text-amber-400 text-xs">
              This browser doesn&apos;t support notifications.
            </p>
          )}
          {notifPrefs.enabled && bgStatus === "granted" && (
            <p className="text-gray-500 text-xs leading-relaxed">
              Reminders also arrive when the app is closed. Android decides
              when to wake it, so one may come a while after your set time.
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

      </main>
      <LeaveGuardSheet guard={leaveGuard} lost="The Mountain Project link you pasted" />
    </div>
  );
}
