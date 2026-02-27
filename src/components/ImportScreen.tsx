import { useState } from "react";
import { HOLDS } from "../data/holds";
import { HOLDS_B } from "../data/workout-b";
import type { HoldDefinition } from "../data/holds";
import { addSession, updateSession, deleteSession } from "../lib/history";
import type { SessionRecord, SessionHoldRecord } from "../lib/history";

type Props = {
  onBack: () => void;
  onSaved: () => void;
  initialRecord?: SessionRecord;
  onDeleted?: () => void;
};

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function localDateString(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function defaultWeights(holds: readonly HoldDefinition[]): number[] {
  return holds.map((h) => h.defaultSet1Weight);
}

function weightsFromRecord(holds: readonly HoldDefinition[], record: SessionRecord): number[] {
  return holds.map((hold) => {
    const hr = record.holds.find((h) => h.holdId === hold.id);
    return hr ? hr.set1.weight : hold.defaultSet1Weight;
  });
}

function offsetFromRecord(holds: readonly HoldDefinition[], record: SessionRecord): number {
  for (const hold of holds) {
    if (hold.isRestOnly || hold.skipProgression) continue;
    const hr = record.holds.find((h) => h.holdId === hold.id);
    if (hr?.set2) return hr.set2.weight - hr.set1.weight;
  }
  return 10;
}

export function ImportScreen({ onBack, onSaved, initialRecord, onDeleted }: Props) {
  const editing = initialRecord !== undefined;
  // "beginner" sessions are treated as "a" in the edit UI (same hold structure)
  const initialType: "a" | "b" = initialRecord?.workoutType === "b" ? "b" : "a";
  const initialHolds = initialType === "b" ? HOLDS_B : HOLDS;

  const [dateValue, setDateValue] = useState(() =>
    initialRecord ? localDateString(initialRecord.startedAt) : todayString()
  );
  const [workoutType, setWorkoutType] = useState<"a" | "b">(initialType);
  const [weights, setWeights] = useState<number[]>(() =>
    initialRecord ? weightsFromRecord(initialHolds, initialRecord) : defaultWeights(HOLDS)
  );
  const [set2Offset, setSet2Offset] = useState(() =>
    initialRecord?.workoutType === "a" ? offsetFromRecord(HOLDS, initialRecord) : 10
  );
  const [sessionNotes, setSessionNotes] = useState(initialRecord?.notes ?? "");
  const [holdNotesState, setHoldNotesState] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (initialRecord?.holds ?? [])
        .filter((h) => h.notes)
        .map((h) => [h.holdId, h.notes!])
    )
  );
  // Which hold note fields are currently open (auto-open holds that already have notes)
  const [expandedNoteHolds, setExpandedNoteHolds] = useState<Set<string>>(
    () => new Set((initialRecord?.holds ?? []).filter((h) => h.notes).map((h) => h.holdId))
  );

  const toggleNote = (holdId: string) =>
    setExpandedNoteHolds((prev) => {
      const next = new Set(prev);
      next.has(holdId) ? next.delete(holdId) : next.add(holdId);
      return next;
    });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const holds = workoutType === "a" ? HOLDS : HOLDS_B;

  const handleTypeChange = (type: "a" | "b") => {
    setWorkoutType(type);
    setWeights(defaultWeights(type === "a" ? HOLDS : HOLDS_B));
  };

  const updateWeight = (index: number, raw: string) => {
    const value = parseFloat(raw);
    setWeights((prev) => {
      const next = [...prev];
      next[index] = isNaN(value) ? 0 : value;
      return next;
    });
  };

  const buildHoldRecords = (): SessionHoldRecord[] =>
    holds.map((hold, i) => {
      const numSets = hold.numSets ?? 2;
      const reps1 = hold.repsPerSet ?? hold.set1Reps;
      const reps2 = hold.repsPerSet ?? hold.set2Reps;
      const w = hold.isRestOnly || hold.skipProgression ? 0 : (weights[i] ?? 0);
      const offset = workoutType === "a" ? set2Offset : hold.defaultSet2Weight - hold.defaultSet1Weight;
      return {
        holdId: hold.id,
        holdName: hold.name,
        set1: { weight: w, reps: reps1, completed: true },
        set2: numSets >= 2 ? { weight: w + offset, reps: reps2, completed: true } : null,
        ...(holdNotesState[hold.id] ? { notes: holdNotesState[hold.id] } : {}),
      };
    });

  const handleSave = async () => {
    setSaving(true);
    try {
      const newTs = new Date(`${dateValue}T12:00:00`).getTime();
      const holdRecords = buildHoldRecords();

      if (editing && initialRecord) {
        const duration = initialRecord.completedAt - initialRecord.startedAt;
        const updated: SessionRecord = {
          ...initialRecord,
          workoutType,
          startedAt: newTs,
          completedAt: duration > 0 ? newTs + duration : newTs,
          holds: holdRecords,
          notes: sessionNotes || undefined,
        };
        await updateSession(updated);
      } else {
        const record: SessionRecord = {
          id: crypto.randomUUID(),
          workoutType,
          startedAt: newTs,
          completedAt: newTs,
          bailed: false,
          imported: true,
          holds: holdRecords,
          ...(sessionNotes ? { notes: sessionNotes } : {}),
        };
        await addSession(record);
      }
      onSaved();
    } catch (err) {
      console.error(err);
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    if (initialRecord) {
      await deleteSession(initialRecord.id).catch(console.error);
      onDeleted?.();
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
        <h1 className="text-white font-bold text-lg">
          {editing ? "Edit Workout" : "Log Past Workout"}
        </h1>
      </header>

      {/* Top controls — always visible */}
      <div className="px-4 pt-4 flex flex-col gap-4 shrink-0">
        {/* Date */}
        <div className="flex items-center gap-3">
          <label className="text-gray-400 text-sm w-12 flex-shrink-0">Date</label>
          <input
            type="date"
            value={dateValue}
            onChange={(e) => setDateValue(e.target.value)}
            className="flex-1 bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-gray-500"
          />
        </div>

        {/* Workout type */}
        <div className="flex items-center gap-3">
          <span className="text-gray-400 text-sm w-12 flex-shrink-0">Type</span>
          <div className="flex gap-2">
            {([["a", "Repeaters"], ["b", "Max Hang"]] as const).map(([t, label]) => (
              <button
                key={t}
                onClick={() => handleTypeChange(t)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  workoutType === t
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-800 text-gray-400 border border-gray-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Set 2 offset — Repeaters only */}
        {workoutType === "a" && (
          <div className="flex items-center gap-3">
            <span className="text-gray-400 text-sm w-12 flex-shrink-0">Offset</span>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-sm">Set 2 is</span>
              <input
                type="number"
                step="0.5"
                value={set2Offset}
                onChange={(e) => setSet2Offset(parseFloat(e.target.value) || 0)}
                className="w-16 bg-gray-800 text-white text-right rounded-lg px-3 py-2 text-sm font-mono border border-gray-700 focus:outline-none focus:border-gray-500"
              />
              <span className="text-gray-500 text-sm">lbs heavier</span>
            </div>
          </div>
        )}
      </div>

      {/* Hold rows — scrollable middle zone */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Hold rows */}
        <div className="bg-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-700 flex items-center justify-between">
            <span className="text-gray-500 text-xs uppercase tracking-wide">Hold</span>
            <span className="text-gray-500 text-xs uppercase tracking-wide text-right">
              {workoutType === "a" ? "Set 1 / Set 2" : "Weight"}
            </span>
          </div>
          {holds.map((hold, i) => {
            const offset = workoutType === "a" ? set2Offset : hold.defaultSet2Weight - hold.defaultSet1Weight;
            const w = weights[i] ?? 0;
            const hasNote = !!holdNotesState[hold.id];
            const noteOpen = expandedNoteHolds.has(hold.id);
            return (
              <div
                key={hold.id}
                className="px-4 py-2.5 flex flex-col border-b border-gray-700 last:border-0"
              >
                <div className="flex items-center gap-3">
                  {/* Hold name — tappable in edit mode to open note field */}
                  {editing ? (
                    <button
                      onClick={() => toggleNote(hold.id)}
                      className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
                    >
                      <span className="text-gray-300 text-sm truncate">{hold.name}</span>
                      {/* Pencil icon: indigo when note exists, near-invisible otherwise */}
                      <svg
                        width="11" height="11" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2.5"
                        strokeLinecap="round" strokeLinejoin="round"
                        className={`flex-shrink-0 transition-colors ${hasNote ? "text-indigo-400" : "text-gray-700"}`}
                      >
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                  ) : (
                    <span className="text-gray-300 text-sm flex-1 truncate">{hold.name}</span>
                  )}
                  {hold.isRestOnly || hold.skipProgression ? (
                    <span className="text-gray-500 text-xs font-mono">BW</span>
                  ) : offset !== 0 ? (
                    <div className="flex items-center rounded border border-gray-600 overflow-hidden flex-shrink-0">
                      <input
                        type="number"
                        step="0.5"
                        value={w}
                        onChange={(e) => updateWeight(i, e.target.value)}
                        className="w-20 bg-gray-700 text-white text-right px-2 py-1 text-sm font-mono focus:outline-none"
                      />
                      <span className="text-gray-600 text-xs px-1">→</span>
                      <span className="w-14 bg-gray-800 text-gray-500 text-right px-2 py-1 text-sm font-mono">
                        {w + offset}
                      </span>
                    </div>
                  ) : (
                    <input
                      type="number"
                      step="0.5"
                      value={w}
                      onChange={(e) => updateWeight(i, e.target.value)}
                      className="w-20 bg-gray-700 text-white text-right rounded px-2 py-1 text-sm font-mono border border-gray-600 focus:outline-none focus:border-gray-400"
                    />
                  )}
                </div>
                {/* Note field — slides open when toggled */}
                {editing && noteOpen && (
                  <textarea
                    // eslint-disable-next-line jsx-a11y/no-autofocus
                    autoFocus
                    value={holdNotesState[hold.id] ?? ""}
                    onChange={(e) =>
                      setHoldNotesState((prev) => ({ ...prev, [hold.id]: e.target.value }))
                    }
                    onBlur={() => {
                      // auto-collapse if the user left it empty
                      if (!holdNotesState[hold.id]) toggleNote(hold.id);
                    }}
                    placeholder={`Note on ${hold.name}…`}
                    rows={2}
                    className="mt-2 w-full bg-gray-700/50 text-white rounded-lg px-3 py-2 text-xs
                               placeholder-gray-600 resize-none border border-gray-700
                               focus:outline-none focus:border-indigo-500/50"
                  />
                )}
              </div>
            );
          })}
        </div>

      </div>

      {/* Bottom actions — always visible */}
      <div className="px-4 pb-6 pt-3 flex flex-col gap-3 shrink-0 border-t border-gray-800">
        {/* Notes */}
        <textarea
          value={sessionNotes}
          onChange={(e) => setSessionNotes(e.target.value)}
          rows={2}
          placeholder="Session notes (optional)"
          className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm placeholder-gray-600 resize-none border border-gray-700 focus:outline-none focus:border-gray-500"
        />

        <button
          onClick={handleSave}
          disabled={saving || !dateValue}
          className="w-full py-3 rounded-xl font-semibold bg-indigo-600 text-white text-base disabled:opacity-50"
        >
          {saving ? "Saving…" : editing ? "Save Changes" : "Save Workout"}
        </button>

        {editing && (
          <button
            onClick={handleDelete}
            className={`w-full py-2.5 rounded-xl font-semibold text-base transition-colors ${
              confirmDelete ? "bg-red-600 text-white" : "bg-gray-800 text-gray-500"
            }`}
          >
            {confirmDelete ? "Tap again to delete" : "Delete Workout"}
          </button>
        )}
      </div>
    </div>
  );
}
