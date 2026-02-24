import { useEffect, useState, useRef } from "react";
import { useWorkoutStore } from "../store/useWorkoutStore";
import { PrepTimer } from "./PrepTimer";
import { HangTimer } from "./HangTimer";
import { BreakTimer } from "./BreakTimer";
import { addSession, buildSessionRecord } from "../lib/history";

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
  const currentHolds = useWorkoutStore((s) => s.currentHolds);
  const startedAt = useWorkoutStore((s) => s.startedAt);
  const selectedWorkout = useWorkoutStore((s) => s.selectedWorkout);
  const effectiveWeight = useWorkoutStore((s) => s.effectiveWeight);

  const [confirming, setConfirming] = useState(false);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [sessionNotes, setSessionNotes] = useState("");
  const sessionNotesRef = useRef("");
  const [doneCountdown, setDoneCountdown] = useState(10);

  const saveSession = (bailed: boolean, notes: string) => {
    if (selectedWorkout === "test" || startedAt === null) return;
    const holds = currentHolds();
    const record = buildSessionRecord({
      workoutType: selectedWorkout,
      startedAt,
      completedAt: Date.now(),
      bailed,
      holdIndex,
      setNumber,
      holds,
      effectiveWeight: (holdId, setNum) => effectiveWeight(holdId, setNum),
      notes: notes || undefined,
    });
    addSession(record).catch(console.error);
  };

  const handleEndClick = () => {
    if (confirming) {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      setConfirming(false);
      saveSession(true, "");
      bailWorkout();
    } else {
      setConfirming(true);
      confirmTimerRef.current = setTimeout(() => setConfirming(false), 3000);
    }
  };

  // Done screen: show notes textarea + 10s countdown
  useEffect(() => {
    if (phase !== "done") return;

    setSessionNotes("");
    sessionNotesRef.current = "";
    setDoneCountdown(10);

    const interval = setInterval(() => {
      if (sessionNotesRef.current !== "") return; // paused while typing
      setDoneCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          saveSession(false, "");
          advancePhase();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const holds = currentHolds();
  const currentHoldDef = holds[holdIndex];
  const numSets = currentHoldDef?.numSets ?? 2;

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
          <div className="flex flex-col items-center gap-6 px-6 w-full max-w-sm">
            <div className="text-center">
              <p className="text-4xl font-bold text-white">Done!</p>
              <p className="text-gray-400 mt-1">Great work.</p>
            </div>
            <textarea
              value={sessionNotes}
              onChange={(e) => {
                setSessionNotes(e.target.value);
                sessionNotesRef.current = e.target.value;
              }}
              placeholder="Any notes? (optional)"
              rows={3}
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm placeholder-gray-600 resize-none border border-gray-700 focus:outline-none focus:border-gray-500"
            />
            <button
              onClick={() => {
                saveSession(false, sessionNotes);
                advancePhase();
              }}
              className="w-full py-3 rounded-xl font-semibold bg-green-600 text-white text-base"
            >
              {sessionNotes === "" ? `Close (${doneCountdown}s)` : "Close"}
            </button>
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

  // A hold segment is "done" when past it, or when it's the current hold in its final break
  const isHoldDone = (i: number) => {
    if (i < holdIndex) return true;
    if (i === holdIndex && phase === "break") {
      const h = holds[i];
      return setNumber >= (h?.numSets ?? 2);
    }
    return false;
  };

  return (
    <div className="h-dvh bg-gray-900 flex flex-col">
      <header className="bg-gray-800 px-4 pt-3 pb-2">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide">Set</p>
            <p className="text-white font-bold text-lg">{setNumber} / {numSets}</p>
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
          {holds.map((h, i) => (
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
