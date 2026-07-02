import { useEffect, useMemo, useState } from "react";
import { HOLDS } from "../data/holds";
import { HOLDS_B } from "../data/workout-b";
import type { HoldDefinition } from "../data/holds";
import { addSession, updateSession, deleteSession } from "../lib/history";
import type { SessionRecord, SessionHoldRecord, SessionSetRecord } from "../lib/history";
import { formatWeight } from "../lib/format";
import { BackChevronIcon } from "./icons";

/** Small tap target to toggle set completion. */
function SetDot({ completed, onClick }: { completed: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-5 h-5 flex-shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
        completed
          ? "border-green-500/60 bg-green-500/20"
          : "border-red-400/60 bg-red-400/20"
      }`}
      aria-label={completed ? "Mark as failed" : "Mark as completed"}
    >
      {completed ? (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-400">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      )}
    </button>
  );
}

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

function localTimeString(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function nowTimeString(): string {
  return localTimeString(Date.now());
}

function defaultWeights(holds: readonly HoldDefinition[]): number[] {
  return holds.map((h) => h.defaultSet1Weight);
}

function offsetFromRecord(record: SessionRecord): number {
  // Jug (and any rest-only hold) sits at bodyweight for both sets, so its
  // set2−set1 is 0 — using it would wrongly report a 0 offset. Skip those and
  // infer the offset from the first real progressing hold instead.
  const skipIds = new Set(HOLDS.filter((h) => h.skipProgression || h.isRestOnly).map((h) => h.id));
  for (const h of record.holds) {
    if (skipIds.has(h.holdId)) continue;
    if (h.set1.completed && h.set2?.completed) return h.set2.weight - h.set1.weight;
  }
  return 10;
}

export function ImportScreen({ onBack, onSaved, initialRecord, onDeleted }: Props) {
  const editing = initialRecord !== undefined;
  // "beginner" sessions are treated as "repeaters" in the edit UI (same hold structure)
  const initialType: "repeaters" | "max-hang" = initialRecord?.workoutType === "max-hang" ? "max-hang" : "repeaters";

  const [dateValue, setDateValue] = useState(() =>
    initialRecord ? localDateString(initialRecord.startedAt) : todayString()
  );
  const [timeValue, setTimeValue] = useState(() =>
    initialRecord ? localTimeString(initialRecord.startedAt) : nowTimeString()
  );
  const [workoutType, setWorkoutType] = useState<"repeaters" | "max-hang">(initialType);
  const [weights, setWeights] = useState<number[]>(() =>
    initialRecord ? initialRecord.holds.map((h) => h.set1.weight) : defaultWeights(HOLDS)
  );
  const [weights2, setWeights2] = useState<number[]>(() =>
    initialRecord
      ? initialRecord.holds.map((h) => h.set2?.weight ?? h.set1.weight)
      : HOLDS.map((h) => h.defaultSet1Weight + 10)
  );
  const [weights3, setWeights3] = useState<number[]>(() =>
    initialRecord
      ? initialRecord.holds.map((h) => h.set3?.weight ?? h.set1.weight)
      : defaultWeights(HOLDS)
  );
  const [set2Offset, setSet2Offset] = useState(() => {
    if (!initialRecord) return 10;
    if (initialRecord.workoutType === "max-hang") return 10;
    return offsetFromRecord(initialRecord);
  });
  const [sessionNotes, setSessionNotes] = useState(initialRecord?.notes ?? "");
  const [holdNotesState, setHoldNotesState] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (initialRecord?.holds ?? [])
        .filter((h) => h.notes)
        .map((h) => [h.holdId, h.notes!])
    )
  );
  const [setNotesState, setSetNotesState] = useState<Record<string, { set1: string; set2: string; set3?: string }>>(() =>
    Object.fromEntries(
      (initialRecord?.holds ?? [])
        .filter((h) => h.set1.notes || h.set2?.notes || h.set3?.notes)
        .map((h) => [h.holdId, { set1: h.set1.notes ?? "", set2: h.set2?.notes ?? "", set3: h.set3?.notes ?? "" }])
    )
  );
  // Which hold note fields are currently open (auto-open holds that already have any notes)
  const [expandedNoteHolds, setExpandedNoteHolds] = useState<Set<string>>(
    () => new Set(
      (initialRecord?.holds ?? [])
        .filter((h) => h.notes || h.set1.notes || h.set2?.notes || h.set3?.notes)
        .map((h) => h.holdId)
    )
  );

  const toggleCompletion = (holdId: string, setKey: "set1" | "set2" | "set3") => {
    setCompletionOverrides((prev) => {
      const current = prev[holdId] ?? {};
      const origHold = origHoldMap.get(holdId);
      const origVal =
        setKey === "set1" ? (origHold?.set1.completed ?? true)
        : setKey === "set2" ? (origHold?.set2?.completed ?? true)
        : (origHold?.set3?.completed ?? true);
      const currentVal = current[setKey] ?? origVal;
      return { ...prev, [holdId]: { ...current, [setKey]: !currentVal } };
    });
  };

  const toggleNote = (holdId: string) =>
    setExpandedNoteHolds((prev) => {
      const next = new Set(prev);
      next.has(holdId) ? next.delete(holdId) : next.add(holdId);
      return next;
    });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Prevent mobile keyboard from opening on mount by blurring any auto-focused input
  useEffect(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, []);

  // Map of holdId → original record hold for edit mode (completion status, original weights)
  const origHoldMap = new Map((initialRecord?.holds ?? []).map((h) => [h.holdId, h]));

  // Togglable completion status per set (holdId → { set1, set2, set3 })
  const [completionOverrides, setCompletionOverrides] = useState<
    Record<string, { set1?: boolean; set2?: boolean; set3?: boolean }>
  >({});

  // In edit mode, detect whether anything has changed from the initial record
  const hasChanges = useMemo(() => {
    if (!editing || !initialRecord) return true; // new record — always saveable
    if (dateValue !== localDateString(initialRecord.startedAt)) return true;
    if (timeValue !== localTimeString(initialRecord.startedAt)) return true;
    if (sessionNotes !== (initialRecord.notes ?? "")) return true;
    for (const [holdId, co] of Object.entries(completionOverrides)) {
      const h = initialRecord.holds.find((x) => x.holdId === holdId);
      if (co.set1 !== undefined && co.set1 !== (h?.set1.completed ?? true)) return true;
      if (co.set2 !== undefined && co.set2 !== (h?.set2?.completed ?? true)) return true;
      if (co.set3 !== undefined && co.set3 !== (h?.set3?.completed ?? true)) return true;
    }
    for (let i = 0; i < initialRecord.holds.length; i++) {
      const h = initialRecord.holds[i];
      if ((weights[i] ?? 0) !== h.set1.weight) return true;
      if ((weights2[i] ?? 0) !== (h.set2?.weight ?? h.set1.weight)) return true;
      if ((weights3[i] ?? 0) !== (h.set3?.weight ?? h.set1.weight)) return true;
      if ((holdNotesState[h.holdId] ?? "") !== (h.notes ?? "")) return true;
      const sn = setNotesState[h.holdId];
      if ((sn?.set1 ?? "") !== (h.set1.notes ?? "")) return true;
      if ((sn?.set2 ?? "") !== (h.set2?.notes ?? "")) return true;
      if ((sn?.set3 ?? "") !== (h.set3?.notes ?? "")) return true;
    }
    return false;
  }, [editing, initialRecord, dateValue, timeValue, sessionNotes, weights, weights2, weights3, completionOverrides, holdNotesState, setNotesState]);

  // In edit mode use the actual holds from the record (preserves non-standard holds like Small Crimp)
  const allDefs = [...HOLDS, ...HOLDS_B];
  const holds: readonly HoldDefinition[] = editing && initialRecord
    ? initialRecord.holds.map((h): HoldDefinition => {
        const def = allDefs.find((d) => d.id === h.holdId) ?? {
          id: h.holdId,
          name: h.holdName,
          defaultSet1Weight: h.set1.weight,
          defaultSet2Weight: h.set2?.weight ?? h.set1.weight,
          set1Reps: h.set1.reps,
          set2Reps: h.set2?.reps ?? h.set1.reps,
        };
        return { ...def, numSets: h.set3 !== undefined ? 3 : h.set2 !== null ? 2 : 1 };
      })
    : workoutType === "repeaters" ? HOLDS : HOLDS_B;

  const handleTypeChange = (type: "repeaters" | "max-hang") => {
    setWorkoutType(type);
    const newHolds = type === "repeaters" ? HOLDS : HOLDS_B;
    setWeights(defaultWeights(newHolds));
    setWeights2(newHolds.map((h) =>
      type === "repeaters" ? h.defaultSet1Weight + set2Offset : h.defaultSet2Weight
    ));
    setWeights3(defaultWeights(newHolds));
  };

  const updateWeight = (index: number, raw: string) => {
    const value = parseFloat(raw);
    setWeights((prev) => {
      const next = [...prev];
      next[index] = isNaN(value) ? 0 : value;
      return next;
    });
  };

  const updateWeight2 = (index: number, raw: string) => {
    const value = parseFloat(raw);
    setWeights2((prev) => {
      const next = [...prev];
      next[index] = isNaN(value) ? 0 : value;
      return next;
    });
  };

  const updateWeight3 = (index: number, raw: string) => {
    const value = parseFloat(raw);
    setWeights3((prev) => {
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
      const origHold = origHoldMap.get(hold.id);
      const co = completionOverrides[hold.id];
      const set1Completed = co?.set1 ?? (!editing || (origHold?.set1.completed ?? true));
      const set2Completed = co?.set2 ?? (!editing || (origHold?.set2?.completed ?? true));
      const set3Completed = co?.set3 ?? (!editing || (origHold?.set3?.completed ?? true));
      const w = hold.isRestOnly || hold.skipProgression ? 0 : (weights[i] ?? 0);
      const w2 = hold.isRestOnly || hold.skipProgression ? 0 : (weights2[i] ?? 0);
      const w3 = hold.isRestOnly || hold.skipProgression ? 0 : (weights3[i] ?? 0);
      const sn = setNotesState[hold.id];
      const set1: SessionSetRecord = {
        weight: w, reps: reps1, completed: set1Completed,
        ...(sn?.set1 ? { notes: sn.set1 } : {}),
      };
      const set2: SessionSetRecord | null = numSets >= 2
        ? { weight: w2, reps: reps2, completed: set2Completed, ...(sn?.set2 ? { notes: sn.set2 } : {}) }
        : null;
      const set3: SessionSetRecord | null | undefined = numSets >= 3
        ? { weight: w3, reps: reps1, completed: set3Completed, ...(sn?.set3 ? { notes: sn.set3 } : {}) }
        : undefined;
      return {
        holdId: hold.id,
        holdName: hold.name,
        set1,
        set2,
        ...(set3 !== undefined ? { set3 } : {}),
        ...(holdNotesState[hold.id] ? { notes: holdNotesState[hold.id] } : {}),
      };
    });

  const handleSave = async () => {
    setSaving(true);
    try {
      const newTs = new Date(`${dateValue}T${timeValue || "12:00"}:00`).getTime();
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
          <BackChevronIcon />
        </button>
        <h1 className="text-white font-bold text-lg">
          {editing ? "Edit Workout" : "Log Past Workout"}
        </h1>
      </header>

      {/* Top controls — always visible */}
      <div className="px-4 pt-4 flex flex-col gap-4 shrink-0">
        {/* Date + Time */}
        <div className="flex items-center gap-3">
          <label className="text-gray-400 text-sm w-12 flex-shrink-0">Date</label>
          <input
            type="date"
            value={dateValue}
            onChange={(e) => setDateValue(e.target.value)}
            className="flex-1 bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-gray-500"
          />
          <input
            type="time"
            value={timeValue}
            onChange={(e) => setTimeValue(e.target.value)}
            className="w-32 bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-gray-500"
          />
        </div>

        {/* Workout type */}
        <div className="flex items-center gap-3">
          <span className="text-gray-400 text-sm w-12 flex-shrink-0">Type</span>
          <div className="flex gap-2">
            {([["repeaters", "Repeaters"], ["max-hang", "Max Hang"]] as const).map(([t, label]) => (
              <button
                key={t}
                onClick={() => handleTypeChange(t)}
                disabled={editing}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  workoutType === t
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-800 text-gray-400 border border-gray-700"
                } disabled:opacity-50 disabled:cursor-default`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Set 2 offset — Repeaters only; batch-updates set 2 weights */}
        {workoutType === "repeaters" && (
          <div className="flex items-center gap-3">
            <span className="text-gray-400 text-sm w-12 flex-shrink-0">Offset</span>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-sm">Set 2 is</span>
              <input
                type="number"
                step="0.5"
                value={set2Offset}
                onChange={(e) => {
                  const newOffset = parseFloat(e.target.value) || 0;
                  setSet2Offset(newOffset);
                  setWeights2(weights.map((w, i) =>
                    (holds[i].isRestOnly || holds[i].skipProgression) ? 0 : w + newOffset
                  ));
                }}
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
              {workoutType === "repeaters" ? "Set 1 / Set 2" : "Set 1 / Set 2 / Set 3"}
            </span>
          </div>
          {holds.map((hold, i) => {
            const w = weights[i] ?? 0;
            const w2 = weights2[i] ?? 0;
            const w3 = weights3[i] ?? 0;
            const sn = setNotesState[hold.id];
            const hasNote = !!holdNotesState[hold.id] || !!sn?.set1 || !!sn?.set2 || !!sn?.set3;
            const noteOpen = expandedNoteHolds.has(hold.id);
            const numSets = hold.numSets ?? 2;
            const co = completionOverrides[hold.id];
            const origHold = origHoldMap.get(hold.id);
            const next = origHold?.next;
            const nextLabel = next
              ? numSets >= 3
                ? `${formatWeight(next.set1)} / ${formatWeight(next.set2 ?? next.set1)} / ${formatWeight(next.set3 ?? next.set1)}`
                : numSets >= 2
                  ? `${formatWeight(next.set1)} → ${formatWeight(next.set2 ?? next.set1)}`
                  : formatWeight(next.set1)
              : null;
            const isCompleted = co?.set1 ?? (!editing || (origHoldMap.get(hold.id)?.set1.completed ?? true));
            const set2Completed = co?.set2 ?? (!editing || (origHoldMap.get(hold.id)?.set2?.completed ?? true));
            const set3Completed = co?.set3 ?? (!editing || (origHoldMap.get(hold.id)?.set3?.completed ?? true));
            return (
              <div
                key={hold.id}
                className="px-4 py-2.5 flex flex-col border-b border-gray-700 last:border-0"
              >
                <div className="flex items-center gap-3">
                  {/* Hold name */}
                  {editing ? (
                    <button
                      onClick={() => toggleNote(hold.id)}
                      className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
                    >
                      <span className="text-gray-300 text-sm truncate">{hold.name}</span>
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
                    <span className={`text-sm flex-1 truncate ${isCompleted ? "text-gray-300" : "text-gray-600"}`}>
                      {hold.name}
                    </span>
                  )}
                  {/* Weight display */}
                  {hold.isRestOnly || hold.skipProgression ? (
                    <span className="text-gray-500 text-xs font-mono">BW</span>
                  ) : numSets >= 3 ? (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {editing && <SetDot completed={isCompleted} onClick={() => toggleCompletion(hold.id, "set1")} />}
                      <input type="number" step="0.5" value={w}
                        onChange={(e) => updateWeight(i, e.target.value)}
                        className={`w-14 bg-gray-700 text-right rounded px-2 py-1 text-sm font-mono border border-gray-600 focus:outline-none focus:border-gray-500 ${isCompleted ? "text-white" : "text-red-400/70 line-through"}`}
                      />
                      {editing && <SetDot completed={set2Completed} onClick={() => toggleCompletion(hold.id, "set2")} />}
                      <input type="number" step="0.5" value={w2}
                        onChange={(e) => updateWeight2(i, e.target.value)}
                        className={`w-14 bg-gray-700 text-right rounded px-2 py-1 text-sm font-mono border border-gray-600 focus:outline-none focus:border-gray-500 ${set2Completed ? "text-white" : "text-red-400/70 line-through"}`}
                      />
                      {editing && <SetDot completed={set3Completed} onClick={() => toggleCompletion(hold.id, "set3")} />}
                      <input type="number" step="0.5" value={w3}
                        onChange={(e) => updateWeight3(i, e.target.value)}
                        className={`w-14 bg-gray-700 text-right rounded px-2 py-1 text-sm font-mono border border-gray-600 focus:outline-none focus:border-gray-500 ${set3Completed ? "text-white" : "text-red-400/70 line-through"}`}
                      />
                    </div>
                  ) : numSets >= 2 ? (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {editing && <SetDot completed={isCompleted} onClick={() => toggleCompletion(hold.id, "set1")} />}
                      <input type="number" step="0.5" value={w}
                        onChange={(e) => updateWeight(i, e.target.value)}
                        className={`w-[4.5rem] bg-gray-700 text-right rounded px-2 py-1 text-sm font-mono border border-gray-600 focus:outline-none focus:border-gray-500 ${isCompleted ? "text-white" : "text-red-400/70 line-through"}`}
                      />
                      <span className="text-gray-600 text-xs">→</span>
                      {editing && <SetDot completed={set2Completed} onClick={() => toggleCompletion(hold.id, "set2")} />}
                      <input type="number" step="0.5" value={w2}
                        onChange={(e) => updateWeight2(i, e.target.value)}
                        className={`w-[4.5rem] bg-gray-700 text-right rounded px-2 py-1 text-sm font-mono border border-gray-600 focus:outline-none focus:border-gray-500 ${set2Completed ? "text-white" : "text-red-400/70 line-through"}`}
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {editing && <SetDot completed={isCompleted} onClick={() => toggleCompletion(hold.id, "set1")} />}
                      <input type="number" step="0.5" value={w}
                        onChange={(e) => updateWeight(i, e.target.value)}
                        className={`w-20 bg-gray-700 text-right rounded px-2 py-1 text-sm font-mono border border-gray-600 focus:outline-none focus:border-gray-500 ${isCompleted ? "text-white" : "text-red-400/70 line-through"}`}
                      />
                    </div>
                  )}
                </div>
                {/* Next-session target captured when the workout was saved */}
                {editing && nextLabel && (
                  <p className="text-gray-500 text-xs font-mono text-right mt-1">
                    Next: {nextLabel}
                  </p>
                )}
                {/* Note fields — slide open when toggled (completed holds only) */}
                {editing && noteOpen && (
                  <div className="mt-2 flex flex-col gap-1.5">
                    <textarea
                      // eslint-disable-next-line jsx-a11y/no-autofocus
                      autoFocus
                      value={holdNotesState[hold.id] ?? ""}
                      onChange={(e) =>
                        setHoldNotesState((prev) => ({ ...prev, [hold.id]: e.target.value }))
                      }
                      placeholder={`Note on ${hold.name}…`}
                      rows={1}
                      className="w-full bg-gray-700/50 text-white rounded-lg px-3 py-2 text-xs
                                 placeholder-gray-600 resize-none border border-gray-700
                                 focus:outline-none focus:border-indigo-500/50"
                    />
                    <textarea
                      value={setNotesState[hold.id]?.set1 ?? ""}
                      onChange={(e) =>
                        setSetNotesState((prev) => ({
                          ...prev,
                          [hold.id]: { ...prev[hold.id], set1: e.target.value },
                        }))
                      }
                      placeholder="Set 1 note…"
                      rows={1}
                      className="w-full bg-gray-700/50 text-white rounded-lg px-3 py-2 text-xs
                                 placeholder-gray-600 resize-none border border-gray-700
                                 focus:outline-none focus:border-indigo-500/50"
                    />
                    {numSets >= 2 && (
                      <textarea
                        value={setNotesState[hold.id]?.set2 ?? ""}
                        onChange={(e) =>
                          setSetNotesState((prev) => ({
                            ...prev,
                            [hold.id]: { ...prev[hold.id], set2: e.target.value },
                          }))
                        }
                        placeholder="Set 2 note…"
                        rows={1}
                        className="w-full bg-gray-700/50 text-white rounded-lg px-3 py-2 text-xs
                                   placeholder-gray-600 resize-none border border-gray-700
                                   focus:outline-none focus:border-indigo-500/50"
                      />
                    )}
                    {numSets >= 3 && (
                      <textarea
                        value={setNotesState[hold.id]?.set3 ?? ""}
                        onChange={(e) =>
                          setSetNotesState((prev) => ({
                            ...prev,
                            [hold.id]: { ...prev[hold.id], set3: e.target.value },
                          }))
                        }
                        placeholder="Set 3 note…"
                        rows={1}
                        className="w-full bg-gray-700/50 text-white rounded-lg px-3 py-2 text-xs
                                   placeholder-gray-600 resize-none border border-gray-700
                                   focus:outline-none focus:border-indigo-500/50"
                      />
                    )}
                  </div>
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

        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="flex-1 py-3 rounded-xl font-semibold bg-gray-800 text-gray-400 text-base"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !dateValue || !hasChanges}
            className="flex-1 py-3 rounded-xl font-semibold bg-indigo-600 text-white text-base disabled:opacity-50"
          >
            {saving ? "Saving…" : editing ? "Save Changes" : "Save Workout"}
          </button>
        </div>

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
