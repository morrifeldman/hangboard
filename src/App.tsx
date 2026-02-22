import { useWorkoutStore } from "./store/useWorkoutStore";
import { useWakeLock } from "./hooks/useWakeLock";
import { HomeScreen } from "./components/HomeScreen";
import { WorkoutScreen } from "./components/WorkoutScreen";

export default function App() {
  const phase = useWorkoutStore((s) => s.phase);
  const isActive = phase !== "idle";

  useWakeLock(isActive);

  if (isActive) {
    return <WorkoutScreen />;
  }

  return <HomeScreen />;
}
