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

type RestorePending = {
  file: BackupFile;
  sessionCount: number;
  climbCount: number;
  fileName: string;
};

export function SettingsScreen({ onBack }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [counts, setCounts] = useState<{ sessions: number; climbs: number } | null>(null);
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

  useEffect(() => {
    Promise.all([getSessions(), getClimbs()])
      .then(([s, c]) => setCounts({ sessions: s.length, climbs: c.length }))
      .catch(() => setCounts({ sessions: 0, climbs: 0 }));
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
        `Downloaded ${a.download} — ${file.data.sessions.length} sessions, ${file.data.climbs.length} climbs.`
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
              {counts.climbs} climb{counts.climbs === 1 ? "" : "s"}
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
              {" "}{pending.sessionCount} session{pending.sessionCount === 1 ? "" : "s"} and{" "}
              {pending.climbCount} climb{pending.climbCount === 1 ? "" : "s"}.
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
