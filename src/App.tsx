import { useState } from "react";
import { useWorkoutStore } from "./store/useWorkoutStore";
import { useWakeLock } from "./hooks/useWakeLock";
import { HomeScreen } from "./components/HomeScreen";
import { WorkoutScreen } from "./components/WorkoutScreen";
import { HistoryScreen } from "./components/HistoryScreen";
import { ImportScreen } from "./components/ImportScreen";
import { GymLogScreen } from "./components/GymLogScreen";
import { ProgressScreen } from "./components/ProgressScreen";
import { PyramidScreen } from "./components/PyramidScreen";
import { ScrollingPyramidsScreen } from "./components/ScrollingPyramidsScreen";
import { SettingsScreen } from "./components/SettingsScreen";
import { NoteEditorScreen } from "./components/NoteEditorScreen";
import { ScheduleScreen } from "./components/ScheduleScreen";
import type { SessionRecord } from "./lib/history";
import type { NoteRecord } from "./lib/notes";

type AppView = "home" | "history" | "import" | "edit" | "gym-log" | "gym-edit" | "progress" | "pyramid" | "scrolling-pyramids" | "settings" | "note-add" | "note-edit" | "schedule";

export default function App() {
  const phase = useWorkoutStore((s) => s.phase);
  const isActive = phase !== "idle";
  const [view, setView] = useState<AppView>("home");
  const [editRecord, setEditRecord] = useState<SessionRecord | null>(null);
  const [gymEditRecord, setGymEditRecord] = useState<SessionRecord | null>(null);
  const [editNote, setEditNote] = useState<NoteRecord | null>(null);
  const [editReturnView, setEditReturnView] = useState<AppView>("history");

  useWakeLock(isActive);

  if (isActive) return <WorkoutScreen />;

  if (view === "history") {
    return (
      <HistoryScreen
        onBack={() => setView("home")}
        onImport={() => setView("import")}
        onImportGym={() => setView("gym-log")}
        onAddNote={() => setView("note-add")}
        onEdit={(record) => {
          if (record.gymData !== undefined) {
            setGymEditRecord(record);
            setView("gym-edit");
          } else {
            setEditRecord(record);
            setEditReturnView("history");
            setView("edit");
          }
        }}
        onEditNote={(note) => { setEditNote(note); setView("note-edit"); }}
      />
    );
  }

  if (view === "import") {
    return (
      <ImportScreen
        onBack={() => setView("history")}
        onSaved={() => setView("history")}
      />
    );
  }

  if (view === "edit" && editRecord) {
    return (
      <ImportScreen
        onBack={() => setView(editReturnView)}
        onSaved={() => { setEditRecord(null); setView(editReturnView); }}
        onDeleted={() => { setEditRecord(null); setView(editReturnView); }}
        initialRecord={editRecord}
      />
    );
  }

  if (view === "gym-log") {
    return (
      <GymLogScreen
        onBack={() => setView("history")}
        onSaved={() => setView("history")}
      />
    );
  }

  if (view === "gym-edit" && gymEditRecord) {
    return (
      <GymLogScreen
        onBack={() => setView("history")}
        onSaved={() => { setGymEditRecord(null); setView("history"); }}
        onDeleted={() => { setGymEditRecord(null); setView("history"); }}
        initialRecord={gymEditRecord}
      />
    );
  }

  if (view === "pyramid") {
    return (
      <PyramidScreen
        onBack={() => setView("home")}
        onShowScrollingPyramids={() => setView("scrolling-pyramids")}
      />
    );
  }

  if (view === "scrolling-pyramids") {
    return <ScrollingPyramidsScreen onBack={() => setView("pyramid")} />;
  }

  if (view === "progress") {
    return (
      <ProgressScreen
        onBack={() => setView("home")}
        onEditSession={(record) => {
          setEditRecord(record);
          setEditReturnView("progress");
          setView("edit");
        }}
      />
    );
  }

  if (view === "settings") {
    return <SettingsScreen onBack={() => setView("home")} />;
  }

  if (view === "schedule") {
    return <ScheduleScreen onBack={() => setView("home")} />;
  }

  if (view === "note-add") {
    return (
      <NoteEditorScreen
        onBack={() => setView("history")}
        onSaved={() => setView("history")}
      />
    );
  }

  if (view === "note-edit" && editNote) {
    return (
      <NoteEditorScreen
        onBack={() => setView("history")}
        onSaved={() => { setEditNote(null); setView("history"); }}
        onDeleted={() => { setEditNote(null); setView("history"); }}
        initialRecord={editNote}
      />
    );
  }

  return (
    <HomeScreen
      onShowHistory={() => setView("history")}
      onShowProgress={() => setView("progress")}
      onLogGym={() => setView("gym-log")}
      onShowPyramid={() => setView("pyramid")}
      onShowSettings={() => setView("settings")}
      onShowSchedule={() => setView("schedule")}
    />
  );
}
