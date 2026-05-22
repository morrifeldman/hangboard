import { useEffect, useState } from "react";
import { addSession, updateSession, deleteSession, getSessions } from "../lib/history";
import type { SessionRecord, GymData, GymWorkoutType, FreeformSection } from "../lib/history";
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

// Extract field values from existing gymData into a flat string map for editing.
// Arrays are joined with "," — round-trips via the multi-select renderer.
function gymDataToFields(gymData: GymData): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(gymData)) {
    if (k === "type" || v === undefined) continue;
    fields[k] = Array.isArray(v) ? v.join(",") : String(v);
  }
  return fields;
}

// Build a GymData from a workout def + field string values; returns null if required fields missing
function buildGymData(def: GymWorkoutDef, fields: Record<string, string>): GymData | null {
  const values: Record<string, string | number | string[]> = { type: def.id };
  for (const fd of def.fieldDefs) {
    const raw = fields[fd.key]?.trim() ?? "";
    if (!raw && !fd.optional) return null; // required field missing
    if (!raw) continue; // optional and empty — omit
    if (fd.type === "number") {
      const n = parseFloat(raw);
      if (isNaN(n)) return null;
      values[fd.key] = n;
    } else if (fd.type === "multi-select") {
      values[fd.key] = raw.split(",").map((s) => s.trim()).filter(Boolean);
    } else {
      values[fd.key] = raw;
    }
  }
  return values as unknown as GymData;
}

function isFormValid(def: GymWorkoutDef, fields: Record<string, string>): boolean {
  return buildGymData(def, fields) !== null;
}

function emptyFreeformSections(): FreeformSection[] {
  return [{ name: "", entries: [{ key: "", value: "" }] }];
}

// Build a freeform GymData; drops empty entries and empty unnamed sections.
// Returns null when the result has no title or no remaining non-empty entries.
function buildFreeformGymData(title: string, sections: FreeformSection[]): GymData | null {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) return null;
  const cleanedSections: FreeformSection[] = [];
  let totalEntries = 0;
  for (const sec of sections) {
    const name = sec.name.trim();
    const entries = sec.entries
      .map((e) => ({ key: e.key.trim(), value: e.value.trim() }))
      .filter((e) => e.key !== "" || e.value !== "");
    if (entries.length === 0 && name === "") continue;
    cleanedSections.push({ name, entries });
    totalEntries += entries.length;
  }
  if (totalEntries === 0) return null;
  return { type: "freeform", title: trimmedTitle, sections: cleanedSections };
}

function collectFreeformAutocomplete(sessions: SessionRecord[]): {
  keys: string[];
  sectionNames: string[];
  lastFreeform: SessionRecord | undefined;
} {
  const keys = new Set<string>();
  const sectionNames = new Set<string>();
  let lastFreeform: SessionRecord | undefined;
  for (const s of sessions) {
    if (s.gymData?.type !== "freeform") continue;
    if (!lastFreeform) lastFreeform = s; // sessions are newest-first from getSessions()
    for (const sec of s.gymData.sections) {
      if (sec.name) sectionNames.add(sec.name);
      for (const e of sec.entries) {
        if (e.key) keys.add(e.key);
      }
    }
  }
  return {
    keys: Array.from(keys).sort(),
    sectionNames: Array.from(sectionNames).sort(),
    lastFreeform,
  };
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

  const initialFreeform =
    initialRecord?.gymData?.type === "freeform" ? initialRecord.gymData : null;
  const [freeformTitle, setFreeformTitle] = useState(initialFreeform?.title ?? "");
  const [freeformSections, setFreeformSections] = useState<FreeformSection[]>(() =>
    initialFreeform
      ? initialFreeform.sections.map((s) => ({
          name: s.name,
          entries: s.entries.map((e) => ({ ...e })),
        }))
      : emptyFreeformSections()
  );

  const [freeformKeys, setFreeformKeys] = useState<string[]>([]);
  const [freeformSectionNames, setFreeformSectionNames] = useState<string[]>([]);
  const [lastFreeform, setLastFreeform] = useState<SessionRecord | undefined>();

  useEffect(() => {
    let cancelled = false;
    getSessions().then((sessions) => {
      if (cancelled) return;
      const { keys, sectionNames, lastFreeform } = collectFreeformAutocomplete(sessions);
      setFreeformKeys(keys);
      setFreeformSectionNames(sectionNames);
      // When editing, don't surface the current record as "last" — that's the one being edited.
      const last = editing ? sessions.find((s) => s.id !== initialRecord?.id && s.gymData?.type === "freeform") : lastFreeform;
      setLastFreeform(last);
    });
    return () => { cancelled = true; };
  }, [editing, initialRecord?.id]);

  const def = GYM_WORKOUTS.find((w) => w.id === workoutType)!;
  const freeformGymData =
    workoutType === "freeform" ? buildFreeformGymData(freeformTitle, freeformSections) : null;
  const valid =
    workoutType === "freeform" ? freeformGymData !== null : isFormValid(def, fields);

  const handleWorkoutTypeChange = (t: GymWorkoutType) => {
    if (editing) return;
    setWorkoutType(t);
    setFields(gymDefaults[t] ?? {});
  };

  const useLastFreeform = () => {
    if (!lastFreeform || lastFreeform.gymData?.type !== "freeform") return;
    const gd = lastFreeform.gymData;
    setFreeformTitle(gd.title);
    setFreeformSections(
      gd.sections.map((s) => ({
        name: s.name,
        entries: s.entries.map((e) => ({ key: e.key, value: "" })),
      }))
    );
  };

  const setFreeformSectionName = (sIdx: number, name: string) =>
    setFreeformSections((prev) =>
      prev.map((sec, i) => (i === sIdx ? { ...sec, name } : sec))
    );
  const setFreeformEntry = (sIdx: number, eIdx: number, patch: Partial<{ key: string; value: string }>) =>
    setFreeformSections((prev) =>
      prev.map((sec, i) =>
        i === sIdx
          ? { ...sec, entries: sec.entries.map((e, j) => (j === eIdx ? { ...e, ...patch } : e)) }
          : sec
      )
    );
  const addFreeformEntry = (sIdx: number) =>
    setFreeformSections((prev) =>
      prev.map((sec, i) =>
        i === sIdx ? { ...sec, entries: [...sec.entries, { key: "", value: "" }] } : sec
      )
    );
  const removeFreeformEntry = (sIdx: number, eIdx: number) =>
    setFreeformSections((prev) =>
      prev.map((sec, i) =>
        i === sIdx ? { ...sec, entries: sec.entries.filter((_, j) => j !== eIdx) } : sec
      )
    );
  const addFreeformSection = () =>
    setFreeformSections((prev) => [...prev, { name: "", entries: [{ key: "", value: "" }] }]);
  const removeFreeformSection = (sIdx: number) =>
    setFreeformSections((prev) => prev.filter((_, i) => i !== sIdx));

  const setField = (key: string, value: string) =>
    setFields((prev) => ({ ...prev, [key]: value }));

  const toggleMultiSelect = (key: string, opt: string) => {
    const current = (fields[key] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const next = current.includes(opt)
      ? current.filter((o) => o !== opt)
      : [...current, opt];
    setField(key, next.join(","));
  };

  const handleSave = async () => {
    const gymData =
      workoutType === "freeform" ? freeformGymData : buildGymData(def, fields);
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
      // Freeform shape doesn't fit the flat Record<string,string> defaults store;
      // "Use last freeform" handles carry-forward instead.
      if (workoutType !== "freeform") {
        setGymDefaults(workoutType, fields);
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
        {workoutType === "freeform" ? (
          <div className="flex flex-col gap-3">
            <input
              type="text"
              value={freeformTitle}
              onChange={(e) => setFreeformTitle(e.target.value)}
              placeholder="Title (required)"
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm placeholder-gray-600 border border-gray-700 focus:outline-none focus:border-gray-500"
            />
            {!editing && lastFreeform && (
              <button
                type="button"
                onClick={useLastFreeform}
                className="self-start text-xs font-semibold text-orange-400 hover:text-orange-300 px-3 py-1.5 rounded-full border border-orange-500/40 bg-orange-500/10"
              >
                ↺ Use last freeform
              </button>
            )}
            {freeformSections.map((sec, sIdx) => (
              <div key={sIdx} className="bg-gray-800 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    list="freeform-section-names"
                    value={sec.name}
                    onChange={(e) => setFreeformSectionName(sIdx, e.target.value)}
                    placeholder="Section name (optional)"
                    className="flex-1 bg-gray-700 text-white rounded-lg px-3 py-1.5 text-sm placeholder-gray-500 border border-gray-600 focus:outline-none focus:border-orange-500/50"
                  />
                  {freeformSections.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeFreeformSection(sIdx)}
                      aria-label="Remove section"
                      className="text-gray-500 hover:text-red-400 text-xl leading-none w-7 h-7 flex items-center justify-center"
                    >
                      ×
                    </button>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  {sec.entries.map((entry, eIdx) => (
                    <div key={eIdx} className="flex items-center gap-2">
                      <input
                        type="text"
                        list="freeform-keys"
                        value={entry.key}
                        onChange={(e) => setFreeformEntry(sIdx, eIdx, { key: e.target.value })}
                        placeholder="key"
                        className="flex-1 min-w-0 bg-gray-700 text-white rounded-lg px-3 py-1.5 text-sm placeholder-gray-500 border border-gray-600 focus:outline-none focus:border-orange-500/50"
                      />
                      <input
                        type="text"
                        value={entry.value}
                        onChange={(e) => setFreeformEntry(sIdx, eIdx, { value: e.target.value })}
                        placeholder="value"
                        className="flex-1 min-w-0 bg-gray-700 text-white rounded-lg px-3 py-1.5 text-sm placeholder-gray-500 border border-gray-600 focus:outline-none focus:border-orange-500/50"
                      />
                      <button
                        type="button"
                        onClick={() => removeFreeformEntry(sIdx, eIdx)}
                        aria-label="Remove entry"
                        className="text-gray-500 hover:text-red-400 text-xl leading-none w-7 h-7 flex items-center justify-center shrink-0"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addFreeformEntry(sIdx)}
                    className="self-start text-xs font-semibold text-gray-400 hover:text-white px-3 py-1.5"
                  >
                    + Add entry
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addFreeformSection}
              className="self-start text-xs font-semibold text-gray-400 hover:text-white px-3 py-1.5 rounded-full border border-gray-700 bg-gray-800"
            >
              + Add section
            </button>
            <datalist id="freeform-keys">
              {freeformKeys.map((k) => <option key={k} value={k} />)}
            </datalist>
            <datalist id="freeform-section-names">
              {freeformSectionNames.map((n) => <option key={n} value={n} />)}
            </datalist>
          </div>
        ) : def && def.fieldDefs.length > 0 && (
          <div className="bg-gray-800 rounded-xl overflow-hidden">
            {def.fieldDefs.map((fd, i) => {
              const isGrade = fd.type === "grade-v" || fd.type === "grade-yds";
              const grades = fd.type === "grade-v" ? V_GRADES : YDS_GRADES;
              const borderCls = i < def.fieldDefs.length - 1 ? "border-b border-gray-700" : "";
              if (fd.type === "multi-select") {
                const selected = new Set((fields[fd.key] ?? "").split(",").map((s) => s.trim()).filter(Boolean));
                return (
                  <div key={fd.key} className={`px-4 py-3 ${borderCls}`}>
                    <label className="text-gray-400 text-sm block mb-2">
                      {fd.label}
                      {fd.optional && <span className="text-gray-600 ml-1 text-xs">(opt)</span>}
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {fd.options?.map((o) => (
                        <button
                          key={o}
                          type="button"
                          onClick={() => toggleMultiSelect(fd.key, o)}
                          className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors whitespace-nowrap ${
                            selected.has(o)
                              ? "bg-orange-500 text-white"
                              : "bg-gray-700 text-gray-400 border border-gray-600"
                          }`}
                        >
                          {o}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              }
              return (
                <div
                  key={fd.key}
                  className={`px-4 py-3 flex items-center gap-3 ${borderCls}`}
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
