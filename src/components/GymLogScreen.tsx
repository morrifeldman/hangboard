import { useEffect, useRef, useState } from "react";
import { addSession, updateSession, deleteSession, getSessions } from "../lib/history";
import type { SessionRecord, GymData, GymWorkoutType, FreeformSection, CampusSet } from "../lib/history";
import { GYM_WORKOUTS, GYM_CATEGORIES, CAMPUS_TEMPLATE, CAMPUS_RUNGS, CAMPUS_NAMES, CAMPUS_SEQUENCES, sequenceShortLabel, shortCodeToSequence, ladderDisplayName, rungShortLabel } from "../data/gymWorkouts";
import type { GymWorkoutDef } from "../data/gymWorkouts";
import { V_GRADES, YDS_GRADES } from "../lib/gradeUtils";
import { useWorkoutStore } from "../store/useWorkoutStore";
import { Audio, initAudio } from "../lib/audio";
import { Haptics } from "../lib/haptics";
import { BackChevronIcon, NoteIcon, ClockIcon, DumbbellIcon, GearIcon } from "./icons";
import { HangboardSetup } from "./HangboardSetup";
import { LiftsForm } from "./LiftsForm";
import { emptyLiftRow, liftRowHasEntries, liftRowToDraft, liftRowsFromEntries } from "../lib/liftRows";
import type { LiftRow } from "../lib/liftRows";
import { commitLifts, currentLiftName } from "../lib/lifts";
import type { LiftDraft } from "../lib/lifts";

const FIELD_CLS =
  "h-11 bg-gray-800 text-white rounded-lg px-3 text-base border border-gray-700 [color-scheme:dark] focus:outline-none focus:border-accent-500";
const PILL_CLS =
  "inline-flex items-center h-10 px-4 rounded-full text-sm font-semibold transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400";
const PILL_ON_CLS = "bg-accent-500 text-gray-900";
const PILL_OFF_CLS = "bg-gray-800 text-gray-300 hover:text-white";

// One size for every − value + control, so the rows line up down the card.
const STEP_BTN_CLS =
  "shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-gray-700/70 text-gray-200 text-xl leading-none active:bg-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400";
const STEP_VALUE_CLS =
  "h-10 bg-transparent text-white text-center font-num text-lg rounded-lg focus:outline-none focus:bg-gray-700/50 focus-visible:ring-2 focus-visible:ring-accent-400";

type Props = {
  onBack: () => void;
  onSaved: () => void;
  initialRecord?: SessionRecord;
  onDeleted?: () => void;
  /** "tab" = Workout tab (no back button, hangboard pill, gear); "edit" = drill-in editor. */
  mode?: "tab" | "edit";
  onShowSettings?: () => void;
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

function campusTemplateSets(): CampusSet[] {
  return CAMPUS_TEMPLATE.map((s) => ({ ...s }));
}

// Build a campus GymData; drops fully-empty rows. Returns null when no row has content.
function buildCampusGymData(sets: CampusSet[]): GymData | null {
  const cleaned: CampusSet[] = [];
  for (const s of sets) {
    const rung = s.rung.trim();
    const name = s.name.trim();
    const sequence = s.sequence.trim();
    const note = s.note?.trim();
    if (!rung && !name && !sequence && !note) continue;
    cleaned.push({ rung, name, sequence, ...(note ? { note } : {}) });
  }
  if (cleaned.length === 0) return null;
  return { type: "campus", sets: cleaned };
}

// Past campus sequences grouped by ladder name — merged with presets so the dropdowns grow.
function collectCampusSequences(sessions: SessionRecord[]): Record<string, string[]> {
  const byName: Record<string, Set<string>> = {};
  for (const s of sessions) {
    if (s.gymData?.type !== "campus") continue;
    for (const row of s.gymData.sets) {
      if (!row.name || !row.sequence) continue;
      (byName[row.name] ??= new Set<string>()).add(row.sequence);
    }
  }
  const out: Record<string, string[]> = {};
  for (const [name, set] of Object.entries(byName)) out[name] = Array.from(set);
  return out;
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

// Standalone rest countdown for campus sessions — no tie to the workout state machine.
// Just a configurable timer you reset between ladders; the chosen length persists.
const REST_KEY = "hangboard-campus-rest-secs";
const REST_PRESETS = [60, 90, 120, 180, 300];

function formatMMSS(secs: number): string {
  const m = Math.floor(secs / 60);
  return `${m}:${String(secs % 60).padStart(2, "0")}`;
}

// Accepts plain seconds ("90") or m:ss ("1:30"); returns null on garbage.
function parseDurationInput(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  if (t.includes(":")) {
    const [m, s] = t.split(":");
    const mins = parseInt(m, 10);
    const secs = parseInt(s, 10);
    if (isNaN(mins) || isNaN(secs)) return null;
    return mins * 60 + secs;
  }
  const n = parseInt(t, 10);
  return isNaN(n) ? null : n;
}

function CampusRestTimer() {
  const [duration, setDuration] = useState<number>(() => {
    const saved = Number(localStorage.getItem(REST_KEY));
    return Number.isFinite(saved) && saved > 0 ? saved : 180;
  });
  const [remaining, setRemaining] = useState(duration);
  const [running, setRunning] = useState(false);
  const deadlineRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) {
        setRunning(false);
        Audio.restEnd();
        Haptics.setComplete();
      }
    }, 250);
    return () => clearInterval(id);
  }, [running]);

  const pickDuration = (secs: number) => {
    setDuration(secs);
    localStorage.setItem(REST_KEY, String(secs));
    setRunning(false);
    setRemaining(secs);
  };

  const toggle = () => {
    if (running) {
      setRunning(false);
      return;
    }
    initAudio(); // unlock the AudioContext inside this user gesture
    Audio.restStart();
    Haptics.hangStart();
    const from = remaining > 0 ? remaining : duration;
    deadlineRef.current = Date.now() + from * 1000;
    setRemaining(from);
    setRunning(true);
  };

  const reset = () => {
    setRunning(false);
    setRemaining(duration);
  };

  const done = !running && remaining === 0;

  return (
    <div className="bg-gray-800 rounded-2xl p-3 flex flex-col gap-2.5">
      <div className="flex items-center gap-3">
        <ClockIcon size={18} className="text-gray-500 shrink-0" />
        <span
          className={`font-num text-3xl ${
            done ? "text-accent-400" : "text-white"
          }`}
        >
          {formatMMSS(remaining)}
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={toggle}
          aria-label={running ? "Pause rest timer" : "Start rest timer"}
          className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-accent-500 text-gray-900 text-lg hover:bg-accent-400 transition-colors"
        >
          {running ? "⏸" : "▶"}
        </button>
        <button
          type="button"
          onClick={reset}
          aria-label="Reset rest timer"
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full border border-gray-600 text-gray-400 hover:text-white text-base"
        >
          ↺
        </button>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {REST_PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => pickDuration(p)}
            aria-pressed={duration === p}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
              duration === p
                ? "bg-accent-500 text-gray-900 border border-accent-500"
                : "text-gray-400 hover:text-white border border-gray-700"
            }`}
          >
            {formatMMSS(p)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            const v = window.prompt("Rest length — seconds or m:ss", formatMMSS(duration));
            if (v == null) return;
            const secs = parseDurationInput(v);
            if (secs != null && secs > 0) pickDuration(secs);
          }}
          aria-pressed={!REST_PRESETS.includes(duration)}
          className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
            !REST_PRESETS.includes(duration)
              ? "bg-accent-500 text-gray-900 border border-accent-500"
              : "text-gray-400 hover:text-white border border-gray-700"
          }`}
        >
          Custom…
        </button>
      </div>
    </div>
  );
}

export function GymLogScreen({ onBack, onSaved, initialRecord, onDeleted, mode, onShowSettings }: Props) {
  const editing = initialRecord !== undefined;
  const tabMode = (mode ?? (editing ? "edit" : "tab")) === "tab";
  // The Workout tab opens on a gym type (ARC by default); the Hangboard pill switches in.
  const [hangboardMode, setHangboardMode] = useState(false);
  const gymDefaults = useWorkoutStore((s) => s.gymDefaults);
  const setGymDefaults = useWorkoutStore((s) => s.setGymDefaults);
  const liftLibrary = useWorkoutStore((s) => s.lifts);
  const addLift = useWorkoutStore((s) => s.addLift);
  const setLiftBase = useWorkoutStore((s) => s.setLiftBase);

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
    initialRecord?.gymData &&
    initialRecord.gymData.type !== "freeform" &&
    initialRecord.gymData.type !== "campus" &&
    initialRecord.gymData.type !== "lifts"
      ? gymDataToFields(initialRecord.gymData)
      : (gymDefaults[initialWorkoutType] ?? {})
  );
  const [sessionNotes, setSessionNotes] = useState(initialRecord?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Workout-type picker: starts open on a new log; collapses to the selected pill once chosen.
  const [pickerOpen, setPickerOpen] = useState(!editing);
  // Pending type awaiting confirmation when the current type has unsaved entries.
  const [pendingType, setPendingType] = useState<GymWorkoutType | null>(null);
  const switchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const initialCampus =
    initialRecord?.gymData?.type === "campus" ? initialRecord.gymData : null;
  const [campusSets, setCampusSets] = useState<CampusSet[]>(() =>
    initialCampus ? initialCampus.sets.map((s) => ({ ...s })) : campusTemplateSets(),
  );
  const [campusSeqByName, setCampusSeqByName] = useState<Record<string, string[]>>({});
  // Row indices whose fold-out note input is revealed (seeded from rows that already have a note).
  const [noteOpen, setNoteOpen] = useState<Set<number>>(() =>
    new Set((initialCampus?.sets ?? []).flatMap((s, i) => (s.note ? [i] : []))),
  );
  // Reveal the full B/L/R hand-sequence code under each compact row.
  const [showCodes, setShowCodes] = useState(false);

  const [liftRows, setLiftRows] = useState<LiftRow[]>(() =>
    initialRecord?.gymData?.type === "lifts"
      ? liftRowsFromEntries(
          initialRecord.gymData.lifts.map((e) => ({ ...e, name: currentLiftName(e, liftLibrary) })),
        )
      : [emptyLiftRow()],
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
      setCampusSeqByName(collectCampusSequences(sessions));
      // When editing, don't surface the current record as "last" — that's the one being edited.
      const last = editing ? sessions.find((s) => s.id !== initialRecord?.id && s.gymData?.type === "freeform") : lastFreeform;
      setLastFreeform(last);
    });
    return () => { cancelled = true; };
  }, [editing, initialRecord?.id]);

  const def = GYM_WORKOUTS.find((w) => w.id === workoutType)!;
  const hasUnits = def.fieldDefs.some((fd) => fd.unit);
  const hasOptional = def.fieldDefs.some((fd) => fd.optional);
  const isCampus = workoutType === "campus";
  const freeformGymData =
    workoutType === "freeform" ? buildFreeformGymData(freeformTitle, freeformSections) : null;
  const campusGymData = isCampus ? buildCampusGymData(campusSets) : null;
  const isLifts = workoutType === "lifts";
  const liftDrafts = isLifts ? liftRows.map(liftRowToDraft) : [];
  const liftsValid =
    liftDrafts.length > 0 &&
    liftDrafts.every((d): d is LiftDraft => d !== null && (!editing || d.liftId !== undefined));
  const valid =
    workoutType === "freeform"
      ? freeformGymData !== null
      : isCampus
        ? campusGymData !== null
        : isLifts
          ? liftsValid
          : isFormValid(def, fields);

  // Per-ladder-name sequence options: presets ∪ previously-logged.
  const sequencesFor = (name: string): string[] =>
    Array.from(new Set([...(CAMPUS_SEQUENCES[name] ?? []), ...(campusSeqByName[name] ?? [])]));

  // Does the current type hold work that switching away would discard?
  const currentTypeHasEntries = (): boolean => {
    if (workoutType === "freeform") {
      return (
        freeformTitle.trim() !== "" ||
        freeformSections.some((s) => s.entries.some((e) => e.key.trim() || e.value.trim()))
      );
    }
    if (workoutType === "campus") {
      return JSON.stringify(campusSets) !== JSON.stringify(campusTemplateSets());
    }
    if (workoutType === "lifts") return liftRows.some(liftRowHasEntries);
    // Compare only non-blank values (cleared/backspaced fields leave "" behind,
    // and saved defaults can contain "" too), independent of key order.
    const meaningful = (m: Record<string, string>) =>
      JSON.stringify(
        Object.entries(m)
          .filter(([, v]) => v.trim() !== "")
          .sort(([a], [b]) => a.localeCompare(b))
      );
    return meaningful(fields) !== meaningful(gymDefaults[workoutType] ?? {});
  };

  const applyWorkoutType = (t: GymWorkoutType) => {
    setWorkoutType(t);
    setFields(gymDefaults[t] ?? {});
    if (t === "campus") {
      setCampusSets(campusTemplateSets());
      setNoteOpen(new Set());
    }
    if (t === "lifts") setLiftRows([emptyLiftRow()]);
  };

  const clearSwitchTimer = () => {
    if (switchTimerRef.current) {
      clearTimeout(switchTimerRef.current);
      switchTimerRef.current = null;
    }
  };

  // Tapping a type pill. First tap selects (the picker stays open so the other pills
  // remain visible); tapping the already-selected pill again collapses the picker.
  // Switching away from a type with entries stages a confirm that auto-resets.
  const requestWorkoutType = (t: GymWorkoutType) => {
    if (editing) return;
    // Leaving the hangboard setup for a gym type — nothing entered to lose. Select, stay open.
    if (hangboardMode) {
      setHangboardMode(false);
      applyWorkoutType(t);
      return;
    }
    if (t === workoutType) {
      // Second tap on the selected pill → collapse to just this one.
      setPickerOpen(false);
      return;
    }
    if (!currentTypeHasEntries()) {
      applyWorkoutType(t);
      return;
    }
    setPendingType(t);
    clearSwitchTimer();
    // Auto-reset so the confirm can never get stuck; timing out simply keeps the
    // current type (the safe default). Generous enough to read the two-button prompt.
    switchTimerRef.current = setTimeout(() => setPendingType(null), 6000);
  };

  // The Hangboard pill — first tap drops into the hangboard setup (picker stays open);
  // a second tap on the now-selected pill collapses the picker.
  const selectHangboard = () => {
    cancelSwitch();
    if (hangboardMode) {
      setPickerOpen(false);
      return;
    }
    setHangboardMode(true);
  };

  const confirmSwitch = () => {
    if (pendingType) applyWorkoutType(pendingType);
    clearSwitchTimer();
    setPendingType(null);
  };

  const cancelSwitch = () => {
    clearSwitchTimer();
    setPendingType(null);
  };

  useEffect(() => clearSwitchTimer, []);

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

  const setCampusRow = (i: number, patch: Partial<CampusSet>) =>
    setCampusSets((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const addCampusRow = () =>
    setCampusSets((prev) => [...prev, { rung: "", name: "", sequence: "" }]);
  const removeCampusRow = (i: number) => {
    setCampusSets((prev) => prev.filter((_, j) => j !== i));
    // Indices above the removed row shift down by one; drop i and renumber.
    setNoteOpen((prev) => {
      const next = new Set<number>();
      prev.forEach((idx) => {
        if (idx < i) next.add(idx);
        else if (idx > i) next.add(idx - 1);
      });
      return next;
    });
  };
  const openNote = (i: number) => setNoteOpen((prev) => new Set(prev).add(i));
  const resetCampusTemplate = () => setCampusSets(campusTemplateSets());

  const setField = (key: string, value: string) =>
    setFields((prev) => ({ ...prev, [key]: value }));

  // Stepper for number fields — bumps the current value (blank counts as 0),
  // clamped at 0 so counts/durations never go negative. Uses the functional
  // updater so rapid taps accumulate instead of reading a stale render value.
  const stepField = (key: string, delta: number) => {
    setFields((prev) => {
      const cur = parseFloat(prev[key] ?? "");
      const base = Number.isFinite(cur) ? cur : 0;
      return { ...prev, [key]: String(Math.max(0, base + delta)) };
    });
  };

  // Stepper for grade fields — moves one step through the grade scale, clamped
  // at the ends. From empty (no default yet) it starts mid-scale.
  const stepGrade = (key: string, grades: string[], delta: number) => {
    setFields((prev) => {
      const idx = grades.indexOf(prev[key] ?? "");
      const next =
        idx === -1
          ? grades[Math.floor(grades.length / 2)]
          : grades[Math.min(grades.length - 1, Math.max(0, idx + delta))];
      return { ...prev, [key]: next };
    });
  };

  const toggleMultiSelect = (key: string, opt: string) => {
    const current = (fields[key] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const next = current.includes(opt)
      ? current.filter((o) => o !== opt)
      : [...current, opt];
    setField(key, next.join(","));
  };

  const handleSave = async () => {
    // Lift ids are settled here, but the library itself only changes once the session is stored.
    const committed = isLifts && liftsValid
      ? commitLifts(liftLibrary, liftDrafts as LiftDraft[], () => crypto.randomUUID())
      : null;
    const gymData: GymData | null =
      workoutType === "freeform"
        ? freeformGymData
        : workoutType === "campus"
          ? campusGymData
          : isLifts
            ? committed && { type: "lifts", lifts: committed.entries }
            : buildGymData(def, fields);
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
        // Only a new session moves the library on. Editing an old one must not
        // roll a lift's base back to whatever was planned back then.
        if (committed) {
          committed.created.forEach(addLift);
          committed.entries.forEach((e) => setLiftBase(e.liftId, e.nextBase));
        }
      }
      // Freeform shape doesn't fit the flat Record<string,string> defaults store;
      // "Use last freeform" handles carry-forward instead.
      if (workoutType !== "freeform" && workoutType !== "campus" && workoutType !== "lifts") {
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
    <div className="h-full bg-gray-900 flex flex-col">
      <header className="bg-gray-800 px-4 pt-4 pb-3 flex items-center gap-3">
        {!tabMode && (
          <button
            onClick={onBack}
            className="text-gray-400 hover:text-white transition-colors p-1 -ml-1"
            aria-label="Back"
          >
            <BackChevronIcon />
          </button>
        )}
        <h1 className="text-white font-bold text-lg">
          {tabMode ? "Workout" : "Edit gym session"}
        </h1>
        {tabMode && onShowSettings && (
          <button
            onClick={onShowSettings}
            aria-label="Open settings"
            data-testid="open-settings"
            className="ml-auto text-gray-400 hover:text-white transition-colors p-1"
          >
            <GearIcon size={22} />
          </button>
        )}
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 pt-4 pb-8 flex flex-col gap-5">
        {!hangboardMode && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              aria-label="Date"
              value={dateValue}
              onChange={(e) => setDateValue(e.target.value)}
              className={`flex-1 min-w-0 ${FIELD_CLS}`}
            />
            <input
              type="time"
              aria-label="Time"
              value={timeValue}
              onChange={(e) => setTimeValue(e.target.value)}
              className={`w-32 ${FIELD_CLS}`}
            />
          </div>
        )}

        {/* Workout type picker — collapses to the selected type once chosen */}
        <div>
          {pickerOpen && !editing ? (
            <div className="flex flex-col gap-3">
              {GYM_CATEGORIES.map((cat) => (
                <div key={cat.id}>
                  <p className="text-gray-500 text-xs mb-1.5">{cat.label}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {GYM_WORKOUTS.filter((w) => w.category === cat.id).map((w) => (
                      <button
                        key={w.id}
                        onClick={() => requestWorkoutType(w.id)}
                        aria-pressed={workoutType === w.id && !hangboardMode}
                        className={`${PILL_CLS} ${
                          workoutType === w.id && !hangboardMode ? PILL_ON_CLS : PILL_OFF_CLS
                        }`}
                      >
                        {w.label}
                      </button>
                    ))}
                    {/* Hangboard launches the guided timer rather than a log form */}
                    {cat.id === "power" && (
                      <button
                        onClick={selectHangboard}
                        data-testid="workout-pill-hangboard"
                        aria-pressed={hangboardMode}
                        className={`${PILL_CLS} gap-1.5 ${hangboardMode ? PILL_ON_CLS : PILL_OFF_CLS}`}
                      >
                        <DumbbellIcon size={14} />
                        Hangboard
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => !editing && setPickerOpen(true)}
              disabled={editing}
              className="inline-flex items-center gap-3 rounded-full disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
            >
              <span className={`${PILL_CLS} gap-1.5 ${PILL_ON_CLS}`}>
                {hangboardMode && <DumbbellIcon size={14} />}
                {hangboardMode ? "Hangboard" : def.label}
              </span>
              {!editing && <span className="text-accent-400 text-sm font-medium">Change</span>}
            </button>
          )}
          {pendingType && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-gray-800 px-3 py-2">
              <p className="flex-1 text-sm text-gray-300">
                Switch to {GYM_WORKOUTS.find((w) => w.id === pendingType)?.label}? Current entries will be cleared.
              </p>
              <button
                type="button"
                onClick={confirmSwitch}
                className="h-9 text-sm font-semibold text-gray-900 bg-accent-500 rounded-lg px-3"
              >
                Switch
              </button>
              <button
                type="button"
                onClick={cancelSwitch}
                className="h-9 text-sm font-semibold text-gray-400 hover:text-white px-2"
              >
                Cancel
              </button>
            </div>
          )}
          {def && !hangboardMode && (
            <p className="text-gray-400 text-sm mt-3">{def.description}</p>
          )}
        </div>

        {/* Hangboard setup — subtype + weights + Start (guided timer) */}
        {hangboardMode && <HangboardSetup />}

        {/* Dynamic fields */}
        {!hangboardMode && (workoutType === "freeform" ? (
          <div className="flex flex-col gap-3">
            <input
              type="text"
              value={freeformTitle}
              onChange={(e) => setFreeformTitle(e.target.value)}
              placeholder="Title (required)"
              className={`w-full placeholder-gray-500 ${FIELD_CLS}`}
            />
            {!editing && lastFreeform && (
              <button
                type="button"
                onClick={useLastFreeform}
                className="self-start text-sm font-medium text-accent-400 hover:text-accent-300 py-1.5"
              >
                Use last freeform
              </button>
            )}
            {freeformSections.map((sec, sIdx) => (
              <div key={sIdx} className="bg-gray-800 rounded-2xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    list="freeform-section-names"
                    value={sec.name}
                    onChange={(e) => setFreeformSectionName(sIdx, e.target.value)}
                    placeholder="Section name (optional)"
                    className="flex-1 bg-gray-700 text-white rounded-lg px-3 py-1.5 text-sm placeholder-gray-500 border border-gray-600 focus:outline-none focus:border-accent-500"
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
                        className="flex-1 min-w-0 bg-gray-700 text-white rounded-lg px-3 py-1.5 text-sm placeholder-gray-500 border border-gray-600 focus:outline-none focus:border-accent-500"
                      />
                      <input
                        type="text"
                        value={entry.value}
                        onChange={(e) => setFreeformEntry(sIdx, eIdx, { value: e.target.value })}
                        placeholder="value"
                        className="flex-1 min-w-0 bg-gray-700 text-white rounded-lg px-3 py-1.5 text-sm placeholder-gray-500 border border-gray-600 focus:outline-none focus:border-accent-500"
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
        ) : isLifts ? (
          <LiftsForm rows={liftRows} onChange={setLiftRows} library={liftLibrary} editing={editing} />
        ) : isCampus ? (
          <div className="flex flex-col gap-3">
            <CampusRestTimer />
            <div className="bg-gray-800 rounded-2xl divide-y divide-gray-700/60">
            {campusSets.map((row, i) => {
              // Presets ∪ previously-saved ∪ sequences already used by same-Name rows
              // in this form — so a custom entry is instantly reusable across sibling sets.
              const seqOptions = Array.from(
                new Set([
                  ...sequencesFor(row.name),
                  ...campusSets
                    .filter((r) => r.name === row.name && r.sequence)
                    .map((r) => r.sequence),
                ]),
              );
              const nameOptions = Array.from(
                new Set([
                  ...CAMPUS_NAMES,
                  ...(row.name && !CAMPUS_NAMES.includes(row.name) ? [row.name] : []),
                ]),
              );
              return (
                <div key={i} className="px-2 py-2 flex flex-col gap-2">
                  <div className="flex items-center gap-1.5">
                    <select
                      value={row.rung}
                      onChange={(e) => setCampusRow(i, { rung: e.target.value })}
                      aria-label="Rung size"
                      title="Rung size"
                      className="shrink-0 bg-gray-700 text-white rounded-lg pl-2 pr-1 py-1.5 text-xs font-semibold border border-gray-600 focus:outline-none focus:border-accent-500"
                    >
                      <option value="" disabled hidden>·</option>
                      {CAMPUS_RUNGS.map((r) => <option key={r} value={r}>{rungShortLabel(r)}</option>)}
                    </select>
                    <select
                      value={row.name}
                      onChange={(e) => setCampusRow(i, { name: e.target.value })}
                      aria-label="Ladder name"
                      className="shrink-0 bg-gray-700 text-white rounded-lg pl-2 pr-1 py-1.5 text-xs border border-gray-600 focus:outline-none focus:border-accent-500"
                    >
                      <option value="" disabled hidden>Name</option>
                      {nameOptions.map((n) => <option key={n} value={n}>{ladderDisplayName(n)}</option>)}
                    </select>
                    <select
                      value={row.sequence}
                      onChange={(e) => {
                        if (e.target.value === "__custom__") {
                          const v = window.prompt(
                            "Hand sequence — full code (B1-L2-R2-…) or short code (e.g. R+1+2, L4)",
                            row.sequence,
                          );
                          if (v != null) {
                            const trimmed = v.trim();
                            setCampusRow(i, { sequence: shortCodeToSequence(trimmed) ?? trimmed });
                          }
                        } else {
                          setCampusRow(i, { sequence: e.target.value });
                        }
                      }}
                      aria-label="Hand sequence"
                      title={row.sequence || "Hand sequence"}
                      className="flex-1 min-w-0 bg-gray-700 text-white rounded-lg pl-2 pr-1 py-1.5 text-xs font-mono border border-gray-600 focus:outline-none focus:border-accent-500"
                    >
                      <option value="" disabled hidden>Seq</option>
                      {seqOptions.map((s) => <option key={s} value={s}>{sequenceShortLabel(s)}</option>)}
                      <option value="__custom__">+ Custom…</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => (noteOpen.has(i) ? setNoteOpen((p) => { const n = new Set(p); n.delete(i); return n; }) : openNote(i))}
                      aria-label={row.note ? "Edit set note" : "Add set note"}
                      title="Note"
                      className={`shrink-0 w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
                        row.note || noteOpen.has(i)
                          ? "text-accent-400 bg-accent-500/10"
                          : "text-gray-500 hover:text-gray-300"
                      }`}
                    >
                      <NoteIcon size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeCampusRow(i)}
                      aria-label="Remove set"
                      className="shrink-0 text-gray-500 hover:text-red-400 text-lg leading-none w-6 h-7 flex items-center justify-center"
                    >
                      ×
                    </button>
                  </div>
                  {showCodes && row.sequence && (
                    <p className="font-mono text-[0.7rem] text-gray-500 px-1 -mt-0.5 break-all">
                      {row.sequence}
                    </p>
                  )}
                  {noteOpen.has(i) && (
                    <input
                      type="text"
                      value={row.note ?? ""}
                      onChange={(e) => setCampusRow(i, { note: e.target.value })}
                      placeholder="Note"
                      aria-label="Set note"
                      autoFocus
                      className="w-full bg-gray-700/60 text-white rounded-lg px-2 py-1.5 text-xs placeholder-gray-500 border border-gray-700 focus:outline-none focus:border-accent-500"
                    />
                  )}
                </div>
              );
            })}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={addCampusRow}
                className="text-xs font-semibold text-gray-400 hover:text-white px-3 py-1.5 rounded-full border border-gray-700 bg-gray-800"
              >
                + Add set
              </button>
              <div className="flex-1" />
              {!editing && (
                <button
                  type="button"
                  onClick={resetCampusTemplate}
                  className="text-sm font-medium text-accent-400 hover:text-accent-300 px-2 py-1.5"
                >
                  Reset to routine
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowCodes((v) => !v)}
                aria-pressed={showCodes}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                  showCodes
                    ? "text-white bg-gray-700 border-gray-600"
                    : "text-gray-400 hover:text-white border-gray-700 bg-gray-800"
                }`}
              >
                {showCodes ? "Hide codes" : "Show codes"}
              </button>
            </div>
          </div>
        ) : def && def.fieldDefs.length > 0 && (
          <div className="bg-gray-800 rounded-2xl overflow-hidden shrink-0 divide-y divide-gray-700/60">
            {/* shrink-0 above is load-bearing: overflow-hidden zeroes the card's min
                flex size, so without it the card compresses (clipping its last rows)
                instead of the page scrolling */}
            {def.fieldDefs.map((fd) => {
              const isGrade = fd.type === "grade-v" || fd.type === "grade-yds";
              const grades = fd.type === "grade-v" ? V_GRADES : YDS_GRADES;
              const value = fields[fd.key] ?? "";
              const label = (
                <div className="flex-1 min-w-0">
                  <label className="text-gray-200 text-sm leading-tight block">{fd.label}</label>
                  {fd.optional && <span className="text-gray-500 text-xs leading-tight">Optional</span>}
                </div>
              );
              if (fd.type === "multi-select") {
                const selected = new Set(value.split(",").map((s) => s.trim()).filter(Boolean));
                return (
                  <div key={fd.key} className="px-4 py-3">
                    <div className="flex items-center mb-2">
                      {label}
                      {fd.optional && selected.size > 0 && (
                        <button
                          type="button"
                          onClick={() => setField(fd.key, "")}
                          className="text-sm font-medium text-gray-500 hover:text-red-400 px-2 py-1"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {fd.options?.map((o) => (
                        <button
                          key={o}
                          type="button"
                          onClick={() => toggleMultiSelect(fd.key, o)}
                          aria-pressed={selected.has(o)}
                          className={`h-9 px-3 rounded-full text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 ${
                            selected.has(o) ? PILL_ON_CLS : "bg-gray-700/70 text-gray-300"
                          }`}
                        >
                          {o}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              }
              if (fd.type === "select") {
                // Tapping the chosen segment again clears an optional field, standing in
                // for the "—" entry the old dropdown had.
                return (
                  <div key={fd.key} className="px-4 py-3">
                    <div className="mb-2">{label}</div>
                    <div role="radiogroup" aria-label={fd.label} className="flex gap-1 rounded-xl bg-gray-900/60 p-1">
                      {fd.options?.map((o) => (
                        <button
                          key={o}
                          type="button"
                          role="radio"
                          aria-checked={value === o}
                          onClick={() => setField(fd.key, value === o && fd.optional ? "" : o)}
                          className={`flex-1 h-9 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 ${
                            value === o ? PILL_ON_CLS : "text-gray-400 hover:text-white"
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
                <div key={fd.key} className="px-4 py-2.5 flex items-center gap-2">
                  {label}
                  {isGrade ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => stepGrade(fd.key, grades, -1)}
                        aria-label={`Decrease ${fd.label}`}
                        className={STEP_BTN_CLS}
                      >
                        −
                      </button>
                      <select
                        value={value}
                        onChange={(e) => setField(fd.key, e.target.value)}
                        aria-label={fd.label}
                        className={`w-16 appearance-none ${STEP_VALUE_CLS} ${value ? "" : "!text-gray-500"}`}
                      >
                        <option value="">—</option>
                        {grades.map((g) => <option key={g} value={g}>{g}</option>)}
                      </select>
                      <button
                        type="button"
                        onClick={() => stepGrade(fd.key, grades, 1)}
                        aria-label={`Increase ${fd.label}`}
                        className={STEP_BTN_CLS}
                      >
                        +
                      </button>
                    </div>
                  ) : fd.type === "text" ? (
                    <input
                      type="text"
                      autoComplete="off"
                      aria-label={fd.label}
                      value={value}
                      onChange={(e) => setField(fd.key, e.target.value)}
                      className="w-40 h-10 bg-gray-700/70 text-white rounded-lg px-3 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
                    />
                  ) : (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => stepField(fd.key, -(fd.step ?? 1))}
                        aria-label={`Decrease ${fd.label}`}
                        className={STEP_BTN_CLS}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        inputMode="numeric"
                        step={fd.step ?? 1}
                        autoComplete="off"
                        aria-label={fd.label}
                        value={value}
                        onChange={(e) => setField(fd.key, e.target.value)}
                        placeholder="—"
                        className={`w-16 placeholder-gray-500 ${STEP_VALUE_CLS} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                      />
                      <button
                        type="button"
                        onClick={() => stepField(fd.key, fd.step ?? 1)}
                        aria-label={`Increase ${fd.label}`}
                        className={STEP_BTN_CLS}
                      >
                        +
                      </button>
                    </div>
                  )}
                  {/* Reserve the unit and clear slots on every row so the steppers line up */}
                  {hasUnits && <span className="text-gray-500 text-xs w-7 shrink-0">{fd.unit}</span>}
                  {fd.optional ? (
                    <button
                      type="button"
                      onClick={() => setField(fd.key, "")}
                      disabled={!value.trim()}
                      aria-label={`Clear ${fd.label}`}
                      className="shrink-0 w-6 h-10 -mr-1 flex items-center justify-center text-lg leading-none text-gray-500 hover:text-red-400 disabled:opacity-0 disabled:pointer-events-none"
                    >
                      ×
                    </button>
                  ) : (
                    hasOptional && <span className="w-6 -mr-1 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {/* Session notes */}
        {!hangboardMode && (
          <textarea
            value={sessionNotes}
            onChange={(e) => setSessionNotes(e.target.value)}
            rows={4}
            placeholder="Session notes (optional)"
            className="w-full shrink-0 min-h-[6rem] bg-gray-800 text-white rounded-2xl px-4 py-3 text-base placeholder-gray-500 resize-y focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
          />
        )}
      </div>

      {/* Bottom actions */}
      {!hangboardMode && (
      <div className="px-4 pb-6 pt-3 flex flex-col gap-3 shrink-0 border-t border-gray-800">
        <button
          onClick={handleSave}
          disabled={saving || !dateValue || !valid}
          className="w-full h-12 rounded-xl font-semibold bg-accent-500 text-gray-900 text-base transition-colors disabled:bg-gray-700 disabled:text-gray-500"
        >
          {saving ? "Saving…" : editing ? "Save changes" : "Save session"}
        </button>

        {editing && (
          <button
            onClick={handleDelete}
            className={`w-full h-11 rounded-xl font-semibold text-base transition-colors ${
              confirmDelete ? "bg-red-600 text-white" : "bg-gray-800 text-red-400"
            }`}
          >
            {confirmDelete ? "Tap again to delete" : "Delete session"}
          </button>
        )}
      </div>
      )}
    </div>
  );
}
