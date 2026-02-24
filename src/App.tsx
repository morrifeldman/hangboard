import { useState } from "react";
import { useWorkoutStore } from "./store/useWorkoutStore";
import { useWakeLock } from "./hooks/useWakeLock";
import { HomeScreen } from "./components/HomeScreen";
import { WorkoutScreen } from "./components/WorkoutScreen";
import { HistoryScreen } from "./components/HistoryScreen";

type AppView = "home" | "history";

export default function App() {
  const phase = useWorkoutStore((s) => s.phase);
  const isActive = phase !== "idle";
  const [view, setView] = useState<AppView>("home");

  useWakeLock(isActive);

  if (isActive) {
    return <WorkoutScreen />;
  }

  if (view === "history") {
    return <HistoryScreen onBack={() => setView("home")} />;
  }

  return <HomeScreen onShowHistory={() => setView("history")} />;
}
