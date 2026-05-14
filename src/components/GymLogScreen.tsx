import { useState } from "react";
import { addSession, updateSession, deleteSession } from "../lib/history";
import type { SessionRecord, GymData, GymWorkoutType } from "../lib/history";
import { GYM_WORKOUTS } from "../data/gymWorkouts";
import type { GymWorkoutDef } from "../data/gymWorkouts";
import { V_GRADES, YDS_GRADES } from "../lib/gradeUtils";
import { useWorkoutStore } from "../store/useWorkoutStore";
import { BackChevronIcon } from "./icons";

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

// Extract field values from existing gymData into a flat string map for editing
function gymDataToFields(gymData: GymData): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(gymData)) {
    if (k !== "type" && v !== undefined) fields[k] = String(v);
  }
  return fields;
}

// Build a GymData from a workout def + field string values; returns null if required fields missing
function buildGymData(def: GymWorkoutDef, fields: Record<string, string>): GymData | null {
  const values: Record<string, string | number> = { type: def.id };
  for (const fd of def.fieldDefs) {
    const raw = fields[fd.key]?.trim() ?? "";
    if (!raw && !fd.optional) return null; // required field missing
    if (!raw) continue; // optional and empty — omit
    if (fd.type === "number") {
      const n = parseFloat(raw);
      if (isNaN(n)) return null;
      values[fd.key] = n;
    } else {
      values[fd.key] = raw;
    }
  }
  return values as unknown as GymData;
}

function isFormValid(def: GymWorkoutDef, fields: Record<string, string>): boolean {
  return buildGymData(def, fields) !== null;
}

export function GymLogScreen({ onBack, onSaved, initialRecord, onDeleted }: Props) {
  const editing = initialRecord !== undefined;
  const gymDefaults = useWorkoutStore((s) => s.gymDefaults);
  const setGymDefaults = useWorkoutStore((s) => s.setGymDefaults);

  const initialWorkoutType: GymWorkoutType =
    initialRecord?.gymData?.type ?? "arc";

  const [dateValue, setDateValue] = useState(() =>
    initialRecord ? localDateString(initialRecord.startedAt) : todayString()
  );
  const [timeValue, setTimeValue] = useState(() =>
    initialRecord ? localTimeString(initialRecord.startedAt) : localTimeString(Date.now())
  );
  const [workoutType, setWorkoutType] = useState<GymWorkoutType>(initialWorkoutType);
  const [fields, setFields] = useState<Record<string, string>>(() =>
    initialRecord?.gymData ? gymDataToFields(initialRecord.gymData) : (gymDefaults[initialWorkoutType] ?? {})
  );
  const [sessionNotes, setSessionNotes] = useState(initialRecord?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const def = GYM_WORKOUTS.find((w) => w.id === workoutType)!;
  const valid = isFormValid(def, fields);

  const handleWorkoutTypeChange = (t: GymWorkoutType) => {
    if (editing) return;
    setWorkoutType(t);
    setFields(gymDefaults[t] ?? {});
  };

  const setField = (key: string, value: string) =>
    setFields((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    const gymData = buildGymData(def, fields);
    if (!gymData) return;
    setSaving(true);
    try {
      const newTs = new Date(`${dateValue}T${timeValue || "12:00"}:00`).getTime();
      if (editing && initialRecord) {
        const duration = initialRecord.completedAt - initialRecord.startedAt;
        const updated: SessionRecord = {
          ...initialRecord,
          workoutType,
          startedAt: newTs,
          completedAt: duration > 0 ? newTs + duration : newTs,
          gymData,
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
          holds: [],
          gymData,
          ...(sessionNotes ? { notes: sessionNotes } : {}),
        };
        await addSession(record);
      }
      setGymDefaults(workoutType, fields);
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
          {editing ? "Edit Gym Session" : "Log Gym Session"}
        </h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5">
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

        {/* Workout type pill picker */}
        <div>
          <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">Workout Type</p>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {GYM_WORKOUTS.map((w) => (
              <button
                key={w.id}
                onClick={() => handleWorkoutTypeChange(w.id)}
                disabled={editing}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap ${
                  workoutType === w.id
                    ? "bg-orange-500 text-white"
                    : "bg-gray-800 text-gray-400 border border-gray-700"
                } disabled:opacity-60 disabled:cursor-default`}
              >
                {w.label}
              </button>
            ))}
          </div>
          {def && (
            <p className="text-gray-600 text-xs mt-2">{def.description}</p>
          )}
        </div>

        {/* Dynamic fields */}
        {def && (
          <div className="bg-gray-800 rounded-xl overflow-hidden">
            {def.fieldDefs.map((fd, i) => {
              const isGrade = fd.type === "grade-v" || fd.type === "grade-yds";
              const grades = fd.type === "grade-v" ? V_GRADES : YDS_GRADES;
              return (
                <div
                  key={fd.key}
                  className={`px-4 py-3 flex items-center gap-3 ${i < def.fieldDefs.length - 1 ? "border-b border-gray-700" : ""}`}
                >
                  <label className="text-gray-400 text-sm flex-1">
                    {fd.label}
                    {fd.optional && <span className="text-gray-600 ml-1 text-xs">(opt)</span>}
                  </label>
                  <div className="flex items-center gap-1.5">
                    {isGrade ? (
                      <select
                        value={fields[fd.key] ?? ""}
                        onChange={(e) => setField(fd.key, e.target.value)}
                        className="w-24 bg-gray-700 text-white rounded-lg px-3 py-1.5 text-sm border border-gray-600 focus:outline-none focus:border-orange-500/50"
                      >
                        <option value="">{fd.type === "grade-v" ? "V?" : "5.?"}</option>
                        {grades.map((g) => <option key={g} value={g}>{g}</option>)}
                      </select>
                    ) : fd.type === "text" ? (
                      <input
                        type="text"
                        autoComplete="off"
                        value={fields[fd.key] ?? ""}
                        onChange={(e) => setField(fd.key, e.target.value)}
                        className="w-32 bg-gray-700 text-white rounded-lg px-3 py-1.5 text-sm border border-gray-600 focus:outline-none focus:border-orange-500/50"
                      />
                    ) : fd.type === "select" ? (
                      <select
                        value={fields[fd.key] ?? ""}
                        onChange={(e) => setField(fd.key, e.target.value)}
                        className="bg-gray-700 text-white rounded-lg px-3 py-1.5 text-sm border border-gray-600 focus:outline-none focus:border-orange-500/50"
                      >
                        <option value="">—</option>
                        {fd.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input
                        type="number"
                        step="1"
                        autoComplete="off"
                        value={fields[fd.key] ?? ""}
                        onChange={(e) => setField(fd.key, e.target.value)}
                        placeholder="0"
                        className="w-20 bg-gray-700 text-white text-right rounded-lg px-3 py-1.5 text-sm font-mono border border-gray-600 focus:outline-none focus:border-orange-500/50"
                      />
                    )}
                    {fd.unit && <span className="text-gray-500 text-xs w-7">{fd.unit}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Session notes */}
        <textarea
          value={sessionNotes}
          onChange={(e) => setSessionNotes(e.target.value)}
          rows={2}
          placeholder="Session notes (optional)"
          className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm placeholder-gray-600 resize-none border border-gray-700 focus:outline-none focus:border-gray-500"
        />
      </div>

      {/* Bottom actions */}
      <div className="px-4 pb-6 pt-3 flex flex-col gap-3 shrink-0 border-t border-gray-800">
        <button
          onClick={handleSave}
          disabled={saving || !dateValue || !valid}
          className="w-full py-3 rounded-xl font-semibold bg-orange-500 text-white text-base disabled:opacity-50"
        >
          {saving ? "Saving…" : editing ? "Save Changes" : "Save Session"}
        </button>

        {editing && (
          <button
            onClick={handleDelete}
            className={`w-full py-2.5 rounded-xl font-semibold text-base transition-colors ${
              confirmDelete ? "bg-red-600 text-white" : "bg-gray-800 text-gray-500"
            }`}
          >
            {confirmDelete ? "Tap again to delete" : "Delete Session"}
          </button>
        )}
      </div>
    </div>
  );
}
