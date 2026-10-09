import { useRef, useState } from "react";
import { backupFilename, exportBackup, restoreBackup, validateBackup } from "../../lib/backup";
import type { BackupFile } from "../../lib/backup";
import { getSessions } from "../../lib/history";
import { getClimbs } from "../../lib/climbs";
import { getNotes } from "../../lib/notes";
import { useLoad } from "../../hooks/useLoad";

type RestorePending = {
  file: BackupFile;
  sessionCount: number;
  climbCount: number;
  noteCount: number;
  fileName: string;
};

type Counts = { sessions: number; climbs: number; notes: number };

async function loadCounts(): Promise<Counts> {
  const [s, c, n] = await Promise.all([getSessions(), getClimbs(), getNotes()]);
  return { sessions: s.length, climbs: c.length, notes: n.length };
}

type Props = {
  /** Change this to recount what's stored, e.g. after another section replaced the climbs. */
  refreshKey?: number;
  /** Called just before the page reloads after a restore, so leave guards stay quiet. */
  onBeforeReload?: () => void;
};

export function BackupSection({ refreshKey = 0, onBeforeReload }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: counts, loading } = useLoad<Counts>(
    loadCounts,
    { sessions: 0, climbs: 0, notes: 0 },
    [refreshKey],
  );
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<RestorePending | null>(null);
  const [restoring, setRestoring] = useState(false);

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
      onBeforeReload?.();
      window.location.reload();
    } catch (err) {
      setRestoring(false);
      setError(`Restore failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <section className="py-6 flex flex-col gap-3">
      <h2 className="text-white font-semibold text-base">Backup and restore</h2>
      <p className="text-gray-400 text-sm leading-relaxed">
        Your workouts, climbs, weights, and settings live only in this browser. Export a JSON
        file you can re-import here later or on another device.
      </p>

      {!loading && (
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
  );
}
