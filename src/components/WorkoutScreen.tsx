import { useEffect, useState, useRef } from "react";
import { useWorkoutStore } from "../store/useWorkoutStore";
import { HOLDS } from "../data/workout";
import { PrepTimer } from "./PrepTimer";
import { HangTimer } from "./HangTimer";
import { BreakTimer } from "./BreakTimer";

export function WorkoutScreen() {
  const phase = useWorkoutStore((s) => s.phase);
  const holdIndex = useWorkoutStore((s) => s.holdIndex);
  const setNumber = useWorkoutStore((s) => s.setNumber);
  const repIndex = useWorkoutStore((s) => s.repIndex);
  const advancePhase = useWorkoutStore((s) => s.advancePhase);
  const bailWorkout = useWorkoutStore((s) => s.bailWorkout);

  const [confirming, setConfirming] = useState(false);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEndClick = () => {
    if (confirming) {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      setConfirming(false);
      bailWorkout();
    } else {
      setConfirming(true);
      confirmTimerRef.current = setTimeout(() => setConfirming(false), 3000);
    }
  };

  const hold = HOLDS[holdIndex];
  const holdsTotal = HOLDS.length;

  // Auto-dismiss done screen after a moment
  useEffect(() => {
    if (phase === "done") {
      const t = setTimeout(advancePhase, 3000);
      return () => clearTimeout(t);
    }
  }, [phase, advancePhase]);

  const renderPanel = () => {
    switch (phase) {
      case "prep":
        return <PrepTimer />;
      case "hanging":
      case "resting":
        return <HangTimer />;
      case "break":
        return <BreakTimer />;
      case "done":
        return (
          <div className="flex flex-col items-center gap-4 px-4 text-center">
            <p className="text-4xl font-bold text-white">Done!</p>
            <p className="text-gray-400">Great work.</p>
          </div>
        );
      default:
        return null;
    }
  };

  const phaseLabel = () => {
    switch (phase) {
      case "prep":     return <span className="text-orange-400">● Get Ready</span>;
      case "hanging":  return <span className="text-green-400">● Hang — Rep {repIndex + 1}</span>;
      case "resting":  return <span className="text-yellow-400">● Rest</span>;
      case "break":    return <span className="text-blue-400">● Break</span>;
      case "done":     return <span className="text-green-400">● Done</span>;
      default:         return null;
    }
  };

  return (
    <div className="h-dvh bg-gray-900 flex flex-col">
      <header className="bg-gray-800 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-xs uppercase tracking-wide">
            {holdIndex + 1} / {holdsTotal}
          </p>
          <h1 className="text-white font-bold text-lg leading-tight" data-testid="hold-name">
            {hold.name}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-gray-400 text-xs uppercase tracking-wide">Set</p>
            <p className="text-white font-bold text-lg">{setNumber} / 2</p>
          </div>
          <button
            onClick={handleEndClick}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
              confirming
                ? "bg-red-600 text-white"
                : "bg-gray-700 text-gray-300"
            }`}
            data-testid="bail-btn"
          >
            {confirming ? "Confirm?" : "End"}
          </button>
        </div>
      </header>

      <div className="bg-gray-800 border-t border-gray-700 px-4 py-1.5" data-testid="phase-bar">
        <span className="text-xs font-semibold uppercase tracking-wide">
          {phaseLabel()}
        </span>
      </div>

      <main className="flex-1 flex flex-col items-center justify-center py-8">
        {renderPanel()}
      </main>
    </div>
  );
}
