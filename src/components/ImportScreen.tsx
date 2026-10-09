import { useEffect, useMemo, useState } from "react";
import { HOLDS } from "../data/holds";
import { HOLDS_B } from "../data/workout-b";
import { isWarmup, plannedReps, warmupVolume } from "../data/holds";
import type { HoldDefinition } from "../data/holds";
import { addSession, updateSession, deleteSession, getSessions } from "../lib/history";
import { bestsBefore, isPR } from "../lib/personalRecords";
import type { SessionRecord, SessionHoldRecord, SessionSetRecord } from "../lib/history";
import { formatWeight } from "../lib/format";
import { holdNextDirection } from "../lib/weightCues";
import { BackChevronIcon } from "./icons";
import { WeightStepper } from "./WeightStepper";
import { WeightCell } from "./WeightCell";
import { useOpenCell } from "../hooks/useOpenCell";
import { PRBadge } from "./PRBadge";
import { LeaveGuardSheet } from "./LeaveGuardSheet";
import { useLeaveGuard } from "../hooks/useLeaveGuard";
import { toLocalDateString, toLocalTimeString, todayDateString } from "../lib/dates";

type Props = {
  onBack: () => void;
  onSaved: () => void;
  initialRecord?: SessionRecord;
  onDeleted?: () => void;
};

function defaultWeights(holds: readonly HoldDefinition[]): number[] {
  return holds.map((h) => h.defaultSet1Weight);
}

const DEFAULT_SET2_OFFSET = 10;

/** The set 1, 2 and 3 weights a new log of this type starts from. */
function startingWeights(type: "repeaters" | "max-hang", set2Offset: number): [number[], number[], number[]] {
  const holds = type === "repeaters" ? HOLDS : HOLDS_B;
  return [
    defaultWeights(holds),
    holds.map((h) => (type === "repeaters" ? h.defaultSet1Weight + set2Offset : h.defaultSet2Weight)),
    defaultWeights(holds),
  ];
}

export function ImportScreen({ onBack, onSaved, initialRecord, onDeleted }: Props) {
  const editing = initialRecord !== undefined;
  // "beginner" sessions are treated as "repeaters" in the edit UI (same hold structure)
  const initialType: "repeaters" | "max-hang" = initialRecord?.workoutType === "max-hang" ? "max-hang" : "repeaters";

  const [dateValue, setDateValue] = useState(() =>
    initialRecord ? toLocalDateString(initialRecord.startedAt) : todayDateString()
  );
  const [timeValue, setTimeValue] = useState(() =>
    initialRecord ? toLocalTimeString(initialRecord.startedAt) : toLocalTimeString(Date.now())
  );
  const [workoutType, setWorkoutType] = useState<"repeaters" | "max-hang">(initialType);
  const [weights, setWeights] = useState<number[]>(() =>
    initialRecord
      ? initialRecord.holds.map((h) => h.set1.weight)
      : startingWeights(initialType, DEFAULT_SET2_OFFSET)[0]
  );
  const [weights2, setWeights2] = useState<number[]>(() =>
    initialRecord
      ? initialRecord.holds.map((h) => h.set2?.weight ?? h.set1.weight)
      : startingWeights(initialType, DEFAULT_SET2_OFFSET)[1]
  );
  const [weights3, setWeights3] = useState<number[]>(() =>
    initialRecord
      ? initialRecord.holds.map((h) => h.set3?.weight ?? h.set1.weight)
      : startingWeights(initialType, DEFAULT_SET2_OFFSET)[2]
  );
  const [set2Offset, setSet2Offset] = useState(DEFAULT_SET2_OFFSET);
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
  // Saved notes show as a one-line preview, so the editors start closed.
  const [expandedNoteHolds, setExpandedNoteHolds] = useState<Set<string>>(() => new Set());
  const [openCell, setOpenCell] = useOpenCell();

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
  const [allSessions, setAllSessions] = useState<SessionRecord[]>([]);
  useEffect(() => {
    getSessions().then(setAllSessions).catch(console.error);
  }, []);
  // Compared against sessions before this one's date, so moving the date re-judges its PRs.
  const priorBests = useMemo(
    () => bestsBefore(allSessions, new Date(`${dateValue}T${timeValue || "12:00"}:00`).getTime(), initialRecord?.id),
    [allSessions, dateValue, timeValue, initialRecord?.id],
  );
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
    if (dateValue !== toLocalDateString(initialRecord.startedAt)) return true;
    if (timeValue !== toLocalTimeString(initialRecord.startedAt)) return true;
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

  // A saved session keeps the reps it was done with, even after the warm-up plan changes.
  const warmupReps = (hold: HoldDefinition): number[] => {
    const saved = initialRecord?.holds.find((h) => h.holdId === hold.id);
    return saved
      ? [saved.set1, saved.set2, saved.set3].filter((x) => x != null).map((x) => x.reps)
      : plannedReps(hold);
  };

  const handleTypeChange = (type: "repeaters" | "max-hang") => {
    setWorkoutType(type);
    const [w1, w2, w3] = startingWeights(type, set2Offset);
    setWeights(w1);
    setWeights2(w2);
    setWeights3(w3);
  };

  const hasNotes =
    sessionNotes.trim() !== "" ||
    Object.values(holdNotesState).some((n) => n.trim() !== "") ||
    Object.values(setNotesState).some((n) => [n.set1, n.set2, n.set3].some((x) => x?.trim()));
  const leaveGuard = useLeaveGuard(
    editing
      ? hasChanges
      : hasNotes ||
          set2Offset !== DEFAULT_SET2_OFFSET ||
          JSON.stringify([weights, weights2, weights3]) !==
            JSON.stringify(startingWeights(workoutType, DEFAULT_SET2_OFFSET)),
  );

  const setAt = (setter: typeof setWeights) => (index: number, value: number) =>
    setter((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  const updateWeight = setAt(setWeights);
  const updateWeight2 = setAt(setWeights2);
  const updateWeight3 = setAt(setWeights3);

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
      leaveGuard.allowLeave();
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
      leaveGuard.allowLeave();
      onDeleted?.();
    }
  };

  // Max Hang has a long warm-up, so it folds away to leave the main hangs in view.
  const warmupIdx = holds.flatMap((h, i) => (isWarmup(h) ? [i] : []));
  const warmupFolds = warmupIdx.length > 1;
  const warmupRepTotal = warmupIdx.reduce((sum, i) => sum + warmupReps(holds[i]).reduce((a, b) => a + b, 0), 0);
  const [warmupOpen, setWarmupOpen] = useState(() =>
    warmupIdx.some((i) => {
      const id = holds[i].id;
      const sn = setNotesState[id];
      return !!holdNotesState[id] || !!sn?.set1 || !!sn?.set2 || !!sn?.set3;
    }),
  );
  const tableSets = Math.max(...holds.map((h) => h.numSets ?? 2));
  const tableCols =
    tableSets >= 3 ? "grid-cols-[minmax(0,1fr)_repeat(3,3.75rem)]"
    : tableSets === 2 ? "grid-cols-[minmax(0,1fr)_repeat(2,4.5rem)]"
    : "grid-cols-[minmax(0,1fr)_4.5rem]";
  const setSpan = tableSets >= 3 ? "col-span-3" : tableSets === 2 ? "col-span-2" : "";

  const holdRow = (hold: HoldDefinition, i: number) => {
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
    const nextDir = origHold ? holdNextDirection(origHold) : null;
    const nextClass =
      nextDir === "up" ? "text-green-400" :
      nextDir === "down" ? "text-red-400" :
      nextDir === "mixed" ? "text-yellow-400" :
      "text-gray-500";
    const nextArrow =
      nextDir === "up" ? " ↑" :
      nextDir === "down" ? " ↓" :
      nextDir === "mixed" ? " ↑↓" :
      "";
    const isCompleted = co?.set1 ?? (!editing || (origHoldMap.get(hold.id)?.set1.completed ?? true));
    const set2Completed = co?.set2 ?? (!editing || (origHoldMap.get(hold.id)?.set2?.completed ?? true));
    const set3Completed = co?.set3 ?? (!editing || (origHoldMap.get(hold.id)?.set3?.completed ?? true));
    const warmup = isWarmup(hold);
    const setStates = ([[w, isCompleted], [w2, set2Completed], [w3, set3Completed]] as const).slice(0, numSets);
    const completedWeights = setStates.filter(([, done]) => done).map(([v]) => v);
    const best = completedWeights.length ? Math.max(...completedWeights) : null;
    const pr = !hold.isRestOnly && !hold.skipProgression && isPR(hold.id, best, priorBests);
    const sectionStart = warmupFolds ? null
      : warmup && i === 0 ? "Warm-up"
      : !warmup && i > 0 && isWarmup(holds[i - 1]) ? "Main hangs"
      : null;
    // The set columns are labelled once, above the first hold that has weights.
    const firstWeighted = !warmup && (i === 0 || isWarmup(holds[i - 1]));
    const weighted = !warmup && !hold.isRestOnly && !hold.skipProgression;
    const noteFields = ([
      ["Hold", holdNotesState[hold.id] ?? "", (v: string) => setHoldNotesState((prev) => ({ ...prev, [hold.id]: v }))],
      ...(["set1", "set2", "set3"] as const).slice(0, numSets).map((key, s) => [
        `Set ${s + 1}`,
        sn?.[key] ?? "",
        (v: string) => setSetNotesState((prev) => ({ ...prev, [hold.id]: { ...prev[hold.id], [key]: v } })),
      ] as const),
    ] as const);
    const notePreview = noteFields.filter(([, v]) => v).map(([label, v]) => (label === "Hold" ? v : `${label}: ${v}`)).join(" · ");
    return (
      <div key={hold.id} className="px-4 py-2 border-b border-gray-700/60 last:border-0">
        {(sectionStart || firstWeighted) && (
          <div
            className={`-mx-4 -mt-2 mb-2 px-4 py-1.5 grid ${tableCols} gap-x-1 items-center border-b border-gray-700/60 bg-gray-900/40 text-xs font-semibold ${
              i === 0 ? "rounded-t-2xl" : ""
            }`}
          >
            <span className={warmup ? "text-teal-300" : "text-gray-300"}>{sectionStart}</span>
            {firstWeighted && Array.from({ length: tableSets }, (_, s) => (
              <span key={s} className="text-center font-medium text-gray-500">Set {s + 1}</span>
            ))}
          </div>
        )}
        <div className={`grid ${tableCols} gap-x-1 items-center`}>
          <div className="min-w-0">
            {editing ? (
              <button
                onClick={() => toggleNote(hold.id)}
                aria-expanded={noteOpen}
                className="flex max-w-full items-center gap-1.5 text-left"
              >
                <span className="text-gray-200 text-sm truncate">{hold.name}</span>
                {pr && <PRBadge />}
                <svg
                  width="11" height="11" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round"
                  aria-label={hasNote ? "Edit notes" : "Add notes"}
                  className={`flex-shrink-0 transition-colors ${hasNote ? "text-accent-400" : "text-gray-600"}`}
                >
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            ) : (
              <span className="flex items-center gap-1.5">
                <span className={`text-sm truncate ${isCompleted ? "text-gray-200" : "text-gray-600"}`}>
                  {hold.name}
                </span>
                {pr && <PRBadge />}
              </span>
            )}
            {editing && nextLabel && weighted && (
              <p className="text-xs truncate text-gray-500">
                Next {nextLabel}<span className={nextClass}>{nextArrow}</span>
              </p>
            )}
          </div>
          {warmup ? (
            <span className={`${setSpan} text-center text-teal-300/90 text-sm font-num`}>{warmupVolume(warmupReps(hold))}</span>
          ) : !weighted ? (
            <span className={`${setSpan} text-center text-gray-400 text-base font-num`}>BW</span>
          ) : (
            setStates.map(([value, completed], s) => {
              const setKey = (["set1", "set2", "set3"] as const)[s];
              const cellKey = `${hold.id}:${setKey}`;
              return (
                <WeightCell
                  key={setKey}
                  label={`${hold.name} set ${s + 1}`}
                  value={value}
                  completed={completed}
                  pr={pr && completed && value === best}
                  onChange={(v) => [updateWeight, updateWeight2, updateWeight3][s](i, v)}
                  onToggleCompleted={editing ? () => toggleCompletion(hold.id, setKey) : undefined}
                  open={openCell === cellKey}
                  onOpen={() => setOpenCell(cellKey)}
                  align={s === tableSets - 1 ? "end" : "center"}
                />
              );
            })
          )}
        </div>
        {editing && !noteOpen && notePreview && (
          <button
            onClick={() => toggleNote(hold.id)}
            className="mt-0.5 block w-full truncate text-left text-xs text-gray-400"
          >
            {notePreview}
          </button>
        )}
        {editing && noteOpen && (
          <div className="mt-2 mb-1 grid grid-cols-[3rem_1fr] items-start gap-x-2 gap-y-1.5">
            {noteFields.map(([label, value, onChange], n) => (
              <label key={label} className="contents">
                <span className="pt-2 text-xs text-gray-500">{label}</span>
                <textarea
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus={n === 0}
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  rows={1}
                  className="w-full bg-gray-700/50 text-white rounded-lg px-3 py-1.5 text-sm
                             placeholder-gray-600 resize-none border border-gray-700
                             focus:outline-none focus:border-accent-500/60 [field-sizing:content]"
                />
              </label>
            ))}
          </div>
        )}
      </div>
    );
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
        <h1 className="text-white font-bold text-lg">
          {editing ? (workoutType === "max-hang" ? "Max Hang" : "Repeaters") : "Log past workout"}
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
            className="flex-1 min-w-0 h-10 bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 [color-scheme:dark] focus:outline-none focus:border-accent-500/60"
          />
          <input
            type="time"
            value={timeValue}
            onChange={(e) => setTimeValue(e.target.value)}
            className="w-32 h-10 bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 [color-scheme:dark] focus:outline-none focus:border-accent-500/60"
          />
        </div>

        {/* A saved session's type can't change, so the header names it instead. */}
        {!editing && <div className="flex items-center gap-3">
          <span className="text-gray-400 text-sm w-12 flex-shrink-0">Type</span>
          <div className="flex gap-2">
            {([["repeaters", "Repeaters"], ["max-hang", "Max Hang"]] as const).map(([t, label]) => (
              <button
                key={t}
                onClick={() => handleTypeChange(t)}
                className={`h-10 px-4 rounded-lg text-sm font-semibold transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 ${
                  workoutType !== t
                    ? "bg-gray-800 text-gray-400 border-gray-700"
                    : "bg-accent-500 text-gray-950 border-transparent"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>}

        {/* Set 2 offset — a shortcut for logging a new Repeaters session; saved ones are edited per set. */}
        {!editing && workoutType === "repeaters" && (
          <div className="flex items-center gap-3">
            <span className="text-gray-400 text-sm w-12 flex-shrink-0">Offset</span>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-sm">Set 2 is</span>
              <WeightStepper
                label="Set 2 offset"
                value={set2Offset}
                formatValue={String}
                onChange={(newOffset) => {
                  setSet2Offset(newOffset);
                  setWeights2(weights.map((w, i) =>
                    (holds[i].isRestOnly || holds[i].skipProgression) ? 0 : w + newOffset
                  ));
                }}
              />
              <span className="text-gray-500 text-sm">lbs heavier</span>
            </div>
          </div>
        )}
      </div>

      {/* Hold rows — scrollable middle zone */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Hold rows */}
        {warmupFolds && (
          <div className="mb-3 rounded-2xl border-l-4 border-teal-400/70 bg-teal-400/[0.07]">
            <button
              type="button"
              onClick={() => setWarmupOpen((o) => !o)}
              aria-expanded={warmupOpen}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
              data-testid="warmup-toggle"
            >
              <div className="min-w-0">
                <p className="text-teal-200 font-semibold">Warm-up</p>
                <p className="text-xs text-teal-100/50">
                  {warmupIdx.length} holds · {warmupRepTotal} reps
                </p>
              </div>
              <svg
                width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                className={`shrink-0 text-teal-300/70 transition-transform motion-reduce:transition-none ${warmupOpen ? "rotate-180" : ""}`}
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {warmupOpen && (
              <div className="border-t border-teal-400/10 [&>div]:border-teal-400/10">
                {warmupIdx.map((i) => holdRow(holds[i], i))}
              </div>
            )}
          </div>
        )}
        <div className="bg-gray-800 rounded-2xl">
          {holds.map((hold, i) => (warmupFolds && isWarmup(hold) ? null : holdRow(hold, i)))}
        </div>

        <textarea
          value={sessionNotes}
          onChange={(e) => setSessionNotes(e.target.value)}
          rows={2}
          placeholder="Session notes"
          className="mt-3 w-full bg-gray-800 text-white rounded-2xl px-4 py-3 text-sm placeholder-gray-500 resize-none border border-gray-700 focus:outline-none focus:border-accent-500/60 [field-sizing:content] min-h-[3.5rem]"
        />

      </div>

      {/* Bottom actions — always visible */}
      <div className="px-4 pb-6 pt-3 flex flex-col gap-3 shrink-0 border-t border-gray-800">
        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="flex-1 py-3 rounded-lg font-semibold bg-gray-800 active:bg-gray-700 text-gray-300 text-base"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !dateValue || !hasChanges}
            className="flex-1 py-3 rounded-lg font-semibold bg-accent-600 active:bg-accent-700 text-white text-base disabled:bg-gray-700 disabled:text-gray-500"
          >
            {saving ? "Saving…" : editing ? "Save changes" : "Save workout"}
          </button>
        </div>

        {editing && (
          <button
            onClick={handleDelete}
            className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-colors ${
              confirmDelete ? "bg-red-600 text-white" : "text-red-400/80 active:bg-gray-800"
            }`}
          >
            {confirmDelete ? "Tap again to delete" : "Delete workout"}
          </button>
        )}
      </div>
      <LeaveGuardSheet
        guard={leaveGuard}
        lost={editing ? "Your changes to this session" : "The hangboard session you've entered"}
      />
    </div>
  );
}
