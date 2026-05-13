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

  useEffect(() => {
    Promise.all([getSessions(), getClimbs()])
      .then(([s, c]) => setCounts({ sessions: s.length, climbs: c.length }))
      .catch(() => setCounts({ sessions: 0, climbs: 0 }));
  }, []);

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
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" /><path d="M12 5l-7 7 7 7" />
          </svg>
        </button>
        <h1 className="text-white font-bold text-lg flex-1">Settings</h1>
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
