import { useEffect, useState } from "react";
import { getSessions, deleteSession } from "../lib/history";
import type { SessionRecord } from "../lib/history";

type Props = {
  onBack: () => void;
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
  const secs = Math.round((completedAt - startedAt) / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
}

function formatWeight(w: number): string {
  if (w === 0) return "BW";
  return w > 0 ? `+${w}kg` : `${w}kg`;
}

function SessionCard({
  record,
  onDelete,
}: {
  record: SessionRecord;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const workoutLabel = record.workoutType === "b" ? "Workout B" : "Workout A";
  const duration = formatDuration(record.startedAt, record.completedAt);

  const handleDelete = () => {
    if (confirmDelete) {
      onDelete(record.id);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  return (
    <div className="bg-gray-800 rounded-xl overflow-hidden">
      {/* Summary row */}
      <button
        className="w-full text-left px-4 py-3 flex items-center justify-between gap-3"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-semibold text-sm">
              {formatDate(record.startedAt)}
            </span>
            <span className="text-gray-400 text-xs">{formatTime(record.startedAt)}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-gray-700 text-gray-300 text-xs px-2 py-0.5 rounded-full font-medium">
              {workoutLabel}
            </span>
            <span className="text-gray-400 text-xs">{duration}</span>
            {record.bailed && (
              <span className="text-yellow-400 text-xs font-medium">Bailed</span>
            )}
          </div>
        </div>
        <span className="text-gray-500 text-lg flex-shrink-0">
          {expanded ? "▲" : "▼"}
        </span>
      </button>

      {/* Expanded hold details */}
      {expanded && (
        <div className="border-t border-gray-700 px-4 py-3 flex flex-col gap-2">
          {record.holds.map((h) => (
            <div key={h.holdId} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-gray-300 truncate flex-1">{h.holdName}</span>
              <div className="flex items-center gap-3 flex-shrink-0 text-xs font-mono">
                {/* Set 1 */}
                <span className={h.set1.completed ? "text-green-400" : "text-gray-600"}>
                  {formatWeight(h.set1.weight)}×{h.set1.reps}
                </span>
                {/* Set 2 */}
                {h.set2 !== null && (
                  <span className={h.set2.completed ? "text-green-400" : "text-gray-600"}>
                    {formatWeight(h.set2.weight)}×{h.set2.reps}
                  </span>
                )}
              </div>
            </div>
          ))}

          {/* Delete button */}
          <div className="flex justify-end pt-2 border-t border-gray-700 mt-1">
            <button
              onClick={handleDelete}
              className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                confirmDelete
                  ? "bg-red-600 text-white"
                  : "bg-gray-700 text-gray-400"
              }`}
            >
              {confirmDelete ? "Confirm delete?" : "Delete"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function HistoryScreen({ onBack }: Props) {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSessions()
      .then(setSessions)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = (id: string) => {
    deleteSession(id).catch(console.error);
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div className="h-dvh bg-gray-900 flex flex-col">
      <header className="bg-gray-800 px-4 pt-4 pb-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-white transition-colors p-1 -ml-1"
          aria-label="Back"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5" />
            <path d="M12 5l-7 7 7 7" />
          </svg>
        </button>
        <h1 className="text-white font-bold text-lg">Workout History</h1>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {loading && (
          <p className="text-gray-500 text-center py-12">Loading…</p>
        )}
        {!loading && sessions.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <p className="text-gray-400 text-base font-medium">No workouts yet</p>
            <p className="text-gray-600 text-sm">Complete a session to see your history here.</p>
          </div>
        )}
        {sessions.map((s) => (
          <SessionCard key={s.id} record={s} onDelete={handleDelete} />
        ))}
      </main>
    </div>
  );
}
