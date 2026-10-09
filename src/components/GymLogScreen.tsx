import { useState } from "react";
import { saveSession, deleteSession, getSessions } from "../lib/history";
import type { SessionRecord, GymData, GymWorkoutType, FreeformSection } from "../lib/history";
import { GYM_WORKOUTS } from "../data/gymWorkouts";
import { useWorkoutStore } from "../store/useWorkoutStore";
import { BackChevronIcon, GearIcon } from "./icons";
import { HangboardSetup } from "./HangboardSetup";
import { LeaveGuardSheet } from "./LeaveGuardSheet";
import { useEditor } from "../hooks/useEditor";
import { useLoad } from "../hooks/useLoad";
import { EditorFooter } from "./EditorFooter";
import { toLocalDateString, toLocalTimeString, todayDateString } from "../lib/dates";
import { LiftsForm } from "./LiftsForm";
import { emptyLiftRow, liftRowHasEntries, liftRowToDraft, liftRowsFromEntries } from "../lib/liftRows";
import type { LiftRow } from "../lib/liftRows";
import { commitLifts, currentLiftName } from "../lib/lifts";
import type { LiftDraft } from "../lib/lifts";
import {
  buildCampusGymData,
  buildFreeformGymData,
  buildGymData,
  campusRowsFromSets,
  campusRowsToSets,
  campusTemplateRows,
  collectGymAutocomplete,
  emptyFreeformSections,
  freeformFingerprint,
  gymDataToFields,
  isFormValid,
  meaningfulFields,
} from "../lib/gymForm";
import type { CampusRow, GymAutocomplete } from "../lib/gymForm";
import { WorkoutTypePicker } from "./gymlog/WorkoutTypePicker";
import { FreeformForm } from "./gymlog/FreeformForm";
import { CampusForm } from "./gymlog/CampusForm";
import { FieldsForm } from "./gymlog/FieldsForm";
import { useTypeSwitch } from "./gymlog/useTypeSwitch";
import { FIELD_CLS } from "./gymlog/styles";

type Props = {
  onBack: () => void;
  /** After a successful save or delete. */
  onDone: () => void;
  initialRecord?: SessionRecord;
  /** "tab" = Workout tab (no back button, hangboard pill, gear); "edit" = drill-in editor. */
  mode?: "tab" | "edit";
  onShowSettings?: () => void;
};

const NO_AUTOCOMPLETE: GymAutocomplete = {
  keys: [],
  sectionNames: [],
  lastFreeform: undefined,
  campusSequences: {},
};

export function GymLogScreen({ onBack, onDone, initialRecord, mode, onShowSettings }: Props) {
  const editing = initialRecord !== undefined;
  const tabMode = (mode ?? (editing ? "edit" : "tab")) === "tab";
  // The Workout tab opens on a gym type (ARC by default); the Hangboard pill switches in.
  const [hangboardMode, setHangboardMode] = useState(false);
  const gymDefaults = useWorkoutStore((s) => s.gymDefaults);
  const setGymDefaults = useWorkoutStore((s) => s.setGymDefaults);
  const liftLibrary = useWorkoutStore((s) => s.lifts);
  const addLift = useWorkoutStore((s) => s.addLift);
  const setLiftBase = useWorkoutStore((s) => s.setLiftBase);

  const initialWorkoutType: GymWorkoutType = initialRecord?.gymData?.type ?? "arc";

  const [dateValue, setDateValue] = useState(() =>
    initialRecord ? toLocalDateString(initialRecord.startedAt) : todayDateString()
  );
  const [timeValue, setTimeValue] = useState(() =>
    initialRecord ? toLocalTimeString(initialRecord.startedAt) : toLocalTimeString(Date.now())
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

  // Workout-type picker: starts open on a new log; collapses to the selected pill once chosen.
  const [pickerOpen, setPickerOpen] = useState(!editing);
  const typeSwitch = useTypeSwitch();

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
  const [freeformBaseline, setFreeformBaseline] = useState(() =>
    freeformFingerprint(freeformTitle, freeformSections),
  );

  const [campusRows, setCampusRows] = useState<CampusRow[]>(() =>
    initialRecord?.gymData?.type === "campus"
      ? campusRowsFromSets(initialRecord.gymData.sets)
      : campusTemplateRows(),
  );

  const [liftRows, setLiftRows] = useState<LiftRow[]>(() =>
    initialRecord?.gymData?.type === "lifts"
      ? liftRowsFromEntries(
          initialRecord.gymData.lifts.map((e) => ({ ...e, name: currentLiftName(e, liftLibrary) })),
        )
      : [emptyLiftRow()],
  );

  // Suggestions from past sessions. When editing, the record being edited is
  // never offered as the "last" freeform.
  const { data: autocomplete } = useLoad(
    () => getSessions().then((sessions) => collectGymAutocomplete(sessions, initialRecord?.id)),
    NO_AUTOCOMPLETE,
    [initialRecord?.id],
  );

  const def = GYM_WORKOUTS.find((w) => w.id === workoutType)!;
  const isCampus = workoutType === "campus";
  const isLifts = workoutType === "lifts";
  const freeformGymData =
    workoutType === "freeform" ? buildFreeformGymData(freeformTitle, freeformSections) : null;
  const campusGymData = isCampus ? buildCampusGymData(campusRows) : null;
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

  // Does the current type hold work that switching away would discard?
  const currentTypeHasEntries = (): boolean => {
    if (workoutType === "freeform") {
      return freeformFingerprint(freeformTitle, freeformSections) !== freeformBaseline;
    }
    if (workoutType === "campus") {
      return (
        JSON.stringify(campusRowsToSets(campusRows)) !==
        JSON.stringify(campusRowsToSets(campusTemplateRows()))
      );
    }
    if (workoutType === "lifts") return liftRows.some(liftRowHasEntries);
    return meaningfulFields(fields) !== meaningfulFields(gymDefaults[workoutType] ?? {});
  };

  // An edit is unsaved once anything differs from the record as it opened.
  const formSnapshot = JSON.stringify([
    dateValue,
    timeValue,
    sessionNotes.trim(),
    meaningfulFields(fields),
    freeformFingerprint(freeformTitle, freeformSections),
    campusRowsToSets(campusRows),
    liftRows,
  ]);
  const [savedSnapshot] = useState(formSnapshot);
  const dirty =
    !hangboardMode &&
    (editing
      ? formSnapshot !== savedSnapshot
      : currentTypeHasEntries() || sessionNotes.trim() !== "");

  const applyWorkoutType = (t: GymWorkoutType) => {
    setWorkoutType(t);
    setFields(gymDefaults[t] ?? {});
    if (t === "campus") setCampusRows(campusTemplateRows());
    if (t === "lifts") setLiftRows([emptyLiftRow()]);
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
    typeSwitch.stage(t);
  };

  // The Hangboard pill — first tap drops into the hangboard setup (picker stays open);
  // a second tap on the now-selected pill collapses the picker.
  const selectHangboard = () => {
    typeSwitch.resolve();
    if (hangboardMode) {
      setPickerOpen(false);
      return;
    }
    setHangboardMode(true);
  };

  const confirmSwitch = () => {
    const t = typeSwitch.resolve();
    if (t) applyWorkoutType(t);
  };

  // When editing, the record being edited is excluded from the "last" freeform.
  const lastFreeform = autocomplete.lastFreeform;
  const useLastFreeform = () => {
    if (!lastFreeform || lastFreeform.gymData?.type !== "freeform") return;
    const gd = lastFreeform.gymData;
    const sections = gd.sections.map((s) => ({
      name: s.name,
      entries: s.entries.map((e) => ({ key: e.key, value: "" })),
    }));
    setFreeformTitle(gd.title);
    setFreeformSections(sections);
    // Carried-forward headings aren't the person's work yet; only what they add is.
    setFreeformBaseline(freeformFingerprint(gd.title, sections));
  };

  // Minted once, so retrying a failed save can't create a second record.
  const [newId] = useState(() => crypto.randomUUID());

  const save = async () => {
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
    if (!gymData) throw new Error("Gym form is incomplete");
    // Untouched date and time keep the original timestamp (and its seconds).
    const unchanged =
      initialRecord &&
      dateValue === toLocalDateString(initialRecord.startedAt) &&
      timeValue === toLocalTimeString(initialRecord.startedAt);
    const startedAt = unchanged
      ? initialRecord.startedAt
      : new Date(`${dateValue}T${timeValue || "12:00"}:00`).getTime();
    if (initialRecord) {
      const duration = initialRecord.completedAt - initialRecord.startedAt;
      await saveSession({
        ...initialRecord,
        workoutType,
        startedAt,
        completedAt: duration > 0 ? startedAt + duration : startedAt,
        gymData,
        notes: sessionNotes || undefined,
      });
    } else {
      await saveSession({
        id: newId,
        workoutType,
        startedAt,
        completedAt: startedAt,
        bailed: false,
        holds: [],
        gymData,
        ...(sessionNotes ? { notes: sessionNotes } : {}),
      });
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
  };

  const editor = useEditor({
    dirty,
    onSave: save,
    onDelete: initialRecord ? () => deleteSession(initialRecord.id) : undefined,
    onDone,
  });

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

        <WorkoutTypePicker
          def={def}
          workoutType={workoutType}
          hangboardMode={hangboardMode}
          editing={editing}
          open={pickerOpen}
          pendingType={typeSwitch.pendingType}
          onSelectType={requestWorkoutType}
          onSelectHangboard={selectHangboard}
          onOpen={() => setPickerOpen(true)}
          onConfirmSwitch={confirmSwitch}
          onCancelSwitch={typeSwitch.resolve}
        />

        {/* Hangboard setup — subtype + weights + Start (guided timer) */}
        {hangboardMode && <HangboardSetup />}

        {!hangboardMode && workoutType === "freeform" && (
          <FreeformForm
            title={freeformTitle}
            sections={freeformSections}
            onTitleChange={setFreeformTitle}
            onSectionsChange={setFreeformSections}
            keys={autocomplete.keys}
            sectionNames={autocomplete.sectionNames}
            canUseLast={!editing && lastFreeform !== undefined}
            onUseLast={useLastFreeform}
          />
        )}
        {!hangboardMode && isLifts && (
          <LiftsForm rows={liftRows} onChange={setLiftRows} library={liftLibrary} editing={editing} />
        )}
        {!hangboardMode && isCampus && (
          <CampusForm
            rows={campusRows}
            onChange={setCampusRows}
            loggedSequences={autocomplete.campusSequences}
            editing={editing}
          />
        )}
        {!hangboardMode && !isCampus && !isLifts && workoutType !== "freeform" && (
          <FieldsForm def={def} fields={fields} onChange={setFields} />
        )}

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

      {!hangboardMode && (
        <EditorFooter
          editor={editor}
          saveLabel={editing ? "Save changes" : "Save session"}
          saveDisabled={!dateValue || !valid}
          deleteLabel="Delete session"
        />
      )}

      <LeaveGuardSheet
        guard={editor.guard}
        lost={
          editing
            ? "Your changes to this session"
            : isLifts
              ? "The lifts you've entered"
              : `Your ${def.label} entry`
        }
      />
    </div>
  );
}
