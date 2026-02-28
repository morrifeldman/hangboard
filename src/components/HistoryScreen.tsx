import { useEffect, useRef, useState } from "react";
import { getSessions, addSession } from "../lib/history";
import type { SessionRecord } from "../lib/history";

type Props = {
  onBack: () => void;
  onImport: () => void;
  onEdit: (record: SessionRecord) => void;
};

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(startedAt: number, completedAt: number): string {
  if (startedAt === completedAt) return "—";
  const secs = Math.round((completedAt - startedAt) / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
}

function SessionCard({ record, onEdit }: { record: SessionRecord; onEdit: (r: SessionRecord) => void }) {
  const workoutLabel =
    record.workoutType === "b" ? "Max Hang" :
    record.workoutType === "beginner" ? "Beginner" : "Repeaters";
  const duration = formatDuration(record.startedAt, record.completedAt);

  return (
    <div className="bg-gray-800 rounded-xl overflow-hidden shrink-0">
      <button
        className="w-full text-left px-4 py-3 flex items-center justify-between gap-3"
        onClick={() => onEdit(record)}
      >
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-semibold text-sm">{formatDate(record.startedAt)}</span>
            <span className="text-gray-400 text-xs">{formatTime(record.startedAt)}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-gray-700 text-gray-300 text-xs px-2 py-0.5 rounded-full font-medium">
              {workoutLabel}
            </span>
            <span className="text-gray-400 text-xs">{duration}</span>
            {record.bailed && <span className="text-yellow-400 text-xs font-medium">Bailed</span>}
            {record.imported && <span className="text-indigo-400 text-xs font-medium">Imported</span>}
            {record.notes && (
              <span className="text-gray-500 text-xs italic truncate max-w-[160px]">"{record.notes}"</span>
            )}
          </div>
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-gray-600 flex-shrink-0"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </div>
  );
}

export function HistoryScreen({ onBack, onImport, onEdit }: Props) {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getSessions()
      .then(setSessions)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImportStatus("Importing…");
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data)) throw new Error("Expected a JSON array");
      const validTypes = new Set(["a", "b", "beginner"]);
      let count = 0;
      for (const item of data) {
        if (
          typeof item !== "object" || item === null ||
          typeof item.id !== "string" ||
          !validTypes.has(item.workoutType) ||
          typeof item.startedAt !== "number" ||
          !Array.isArray(item.holds)
        ) {
          throw new Error(`Invalid record: ${JSON.stringify(item).slice(0, 60)}`);
        }
        await addSession({ ...item, id: crypto.randomUUID(), imported: true } as SessionRecord);
        count++;
      }
      const refreshed = await getSessions();
      setSessions(refreshed);
      setImportStatus(`Imported ${count} session${count !== 1 ? "s" : ""}`);
    } catch (err) {
      setImportStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
    setTimeout(() => setImportStatus(null), 4000);
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
        <h1 className="text-white font-bold text-lg flex-1">Workout History</h1>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="text-gray-400 hover:text-white transition-colors p-1"
          aria-label="Import JSON"
          title="Import JSON file"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="12" y1="18" x2="12" y2="12"/>
            <polyline points="9 15 12 12 15 15"/>
          </svg>
        </button>
        <input
          type="file"
          accept=".json"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          onClick={onImport}
          className="text-gray-400 hover:text-white transition-colors p-1"
          aria-label="Log past workout"
          title="Log past workout"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14" /><path d="M5 12h14" />
          </svg>
        </button>
      </header>
      {importStatus && (
        <div className="bg-gray-800 border-t border-gray-700 px-4 py-2 text-sm text-gray-300">
          {importStatus}
        </div>
      )}

      <main className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {loading && <p className="text-gray-500 text-center py-12">Loading…</p>}
        {!loading && sessions.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <p className="text-gray-400 text-base font-medium">No workouts yet</p>
            <p className="text-gray-600 text-sm">Complete a session to see your history here.</p>
          </div>
        )}
        {sessions.map((s) => (
          <SessionCard key={s.id} record={s} onEdit={onEdit} />
        ))}
      </main>
    </div>
  );
}
