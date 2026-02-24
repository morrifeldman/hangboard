import { useState, useEffect } from "react";
import { seedTestHistory } from "./lib/seedHistory";
import { useWorkoutStore } from "./store/useWorkoutStore";
import { useWakeLock } from "./hooks/useWakeLock";
import { HomeScreen } from "./components/HomeScreen";
import { WorkoutScreen } from "./components/WorkoutScreen";
import { HistoryScreen } from "./components/HistoryScreen";
import { ImportScreen } from "./components/ImportScreen";
import type { SessionRecord } from "./lib/history";

type AppView = "home" | "history" | "import" | "edit";

export default function App() {
  const phase = useWorkoutStore((s) => s.phase);
  const isActive = phase !== "idle";
  const [view, setView] = useState<AppView>("home");
  const [editRecord, setEditRecord] = useState<SessionRecord | null>(null);

  useWakeLock(isActive);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("test")) {
      seedTestHistory().catch(console.error);
    }
  }, []);

  if (isActive) return <WorkoutScreen />;

  if (view === "history") {
    return (
      <HistoryScreen
        onBack={() => setView("home")}
        onImport={() => setView("import")}
        onEdit={(record) => { setEditRecord(record); setView("edit"); }}
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
        onBack={() => setView("history")}
        onSaved={() => { setEditRecord(null); setView("history"); }}
        onDeleted={() => { setEditRecord(null); setView("history"); }}
        initialRecord={editRecord}
      />
    );
  }

  return <HomeScreen onShowHistory={() => setView("history")} />;
}
