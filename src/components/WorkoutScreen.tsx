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
  const paused = useWorkoutStore((s) => s.paused);
  const pauseWorkout = useWorkoutStore((s) => s.pauseWorkout);
  const resumeWorkout = useWorkoutStore((s) => s.resumeWorkout);

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

  // A hold segment is "done" when past, or when it's current and the between-holds break is running
  const isHoldDone = (i: number) =>
    i < holdIndex || (i === holdIndex && phase === "break" && setNumber === 2);

  return (
    <div className="h-dvh bg-gray-900 flex flex-col">
      <header className="bg-gray-800 px-4 pt-3 pb-2">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide">Set</p>
            <p className="text-white font-bold text-lg">{setNumber} / 2</p>
          </div>
          <div className="flex items-center gap-3">
            {phase !== "done" && (
              <button
                onClick={paused ? resumeWorkout : pauseWorkout}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-gray-700 text-gray-300 transition-colors"
                data-testid="pause-btn"
              >
                {paused ? "Resume" : "Pause"}
              </button>
            )}
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
        </div>
        <div className="flex gap-1">
          {HOLDS.map((h, i) => (
            <div
              key={h.id}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                isHoldDone(i)
                  ? "bg-white/50"
                  : i === holdIndex
                  ? "bg-white"
                  : "bg-gray-600"
              }`}
            />
          ))}
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
