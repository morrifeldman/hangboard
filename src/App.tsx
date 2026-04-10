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
import type { SessionRecord } from "./lib/history";

type AppView = "home" | "history" | "import" | "edit" | "gym-log" | "gym-edit" | "progress" | "pyramid";

export default function App() {
  const phase = useWorkoutStore((s) => s.phase);
  const isActive = phase !== "idle";
  const [view, setView] = useState<AppView>("home");
  const [editRecord, setEditRecord] = useState<SessionRecord | null>(null);
  const [gymEditRecord, setGymEditRecord] = useState<SessionRecord | null>(null);
  const [editReturnView, setEditReturnView] = useState<AppView>("history");

  useWakeLock(isActive);

  if (isActive) return <WorkoutScreen />;

  if (view === "history") {
    return (
      <HistoryScreen
        onBack={() => setView("home")}
        onImport={() => setView("import")}
        onImportGym={() => setView("gym-log")}
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
    return <PyramidScreen onBack={() => setView("home")} />;
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

  return (
    <HomeScreen
      onShowHistory={() => setView("history")}
      onShowProgress={() => setView("progress")}
      onLogGym={() => setView("gym-log")}
      onShowPyramid={() => setView("pyramid")}
    />
  );
}
