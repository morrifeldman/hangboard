import { useEffect, useState, useRef } from "react";
import { useWorkoutStore } from "../store/useWorkoutStore";
import { PrepTimer } from "./PrepTimer";
import { HangTimer } from "./HangTimer";
import { BreakTimer } from "./BreakTimer";
import { addSession, buildSessionRecord } from "../lib/history";
import { WeightAdjuster } from "./WeightAdjuster";
import { currentPhaseFullSecs, remainingWorkoutSecs, finishClockTime } from "../lib/workoutTime";
import { SET1_REPS, SET2_REPS } from "../data/workout";
import { isWarmup } from "../data/holds";

function fmtTime(s: number): string {
  const t = Math.max(0, Math.round(s));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = t % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

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
  const nextSessionWeight = useWorkoutStore((s) => s.nextSessionWeight);
  const adjustNextWeight = useWorkoutStore((s) => s.adjustNextWeight);
  // Subscribed so the done-screen adjuster re-renders when a tap changes the persisted target.
  useWorkoutStore((s) => s.weights);
  useWorkoutStore((s) => s.weightsB);
  const totalScheduledSecs = useWorkoutStore((s) => s.totalScheduledSecs);

  const [confirming, setConfirming] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  const [holdNotes, setHoldNotes] = useState<Record<string, string>>({});
  const [setNotesLive, setSetNotesLive] = useState<Record<string, { set1?: string; set2?: string; set3?: string }>>({});
  const [failedSets, setFailedSets] = useState<Record<string, { set1?: boolean; set2?: boolean; set3?: boolean }>>({});
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [sessionNotes, setSessionNotes] = useState("");
  const [lastHoldNotesOpen, setLastHoldNotesOpen] = useState(false);
  const [workoutNotesOpen, setWorkoutNotesOpen] = useState(false);

  // Track fullscreen state
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  };

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
      nextWeight: (holdId, setNum) => nextSessionWeight(holdId, setNum),
      notes: notes || undefined,
      holdNotes,
      setNotes: setNotesLive,
      failedSets,
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

  // Done screen: reset notes state
  useEffect(() => {
    if (phase !== "done") return;
    setSessionNotes("");
    setLastHoldNotesOpen(false);
    setWorkoutNotesOpen(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const holds = currentHolds();
  const currentHoldDef = holds[holdIndex];
  const numSets = currentHoldDef?.numSets ?? 2;

  // Track elapsed in the current phase so we can derive "remaining" / "done" / "total" for the header.
  // Refs reset whenever the SessionState advances; pause time is accumulated separately so the
  // numbers freeze on pause and resume cleanly.
  const phaseStartedAtRef = useRef(Date.now());
  const phasePausedAccumRef = useRef(0);
  const pauseStartedAtRef = useRef<number | null>(paused ? Date.now() : null);
  const lastSessionStateRef = useRef({ phase, holdIndex, setNumber, repIndex });
  const [, forceTick] = useState(0);

  // Reset phase tracking SYNCHRONOUSLY when state advances. Doing this in useEffect would leave
  // one rendered frame where the new phase is paired with the old phaseStartedAt — making
  // remaining look momentarily smaller and elapsed appear to tick backwards on the next frame.
  const prev = lastSessionStateRef.current;
  if (
    prev.phase !== phase ||
    prev.holdIndex !== holdIndex ||
    prev.setNumber !== setNumber ||
    prev.repIndex !== repIndex
  ) {
    lastSessionStateRef.current = { phase, holdIndex, setNumber, repIndex };
    phaseStartedAtRef.current = Date.now();
    phasePausedAccumRef.current = 0;
    pauseStartedAtRef.current = paused ? Date.now() : null;
  }

  useEffect(() => {
    if (paused) {
      pauseStartedAtRef.current = Date.now();
    } else if (pauseStartedAtRef.current !== null) {
      phasePausedAccumRef.current += (Date.now() - pauseStartedAtRef.current) / 1000;
      pauseStartedAtRef.current = null;
    }
  }, [paused]);

  useEffect(() => {
    if (phase === "idle" || phase === "done") return;
    const id = setInterval(() => forceTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  const sessionState = { phase, holdIndex, setNumber, repIndex };
  const phaseFull = currentPhaseFullSecs(sessionState, holds);
  const pausedNow =
    paused && pauseStartedAtRef.current !== null
      ? (Date.now() - pauseStartedAtRef.current) / 1000
      : 0;
  const phaseElapsed =
    (Date.now() - phaseStartedAtRef.current) / 1000 -
    phasePausedAccumRef.current -
    pausedNow;
  const phaseRemaining = Math.max(0, phaseFull - phaseElapsed);
  const remainingSecs = remainingWorkoutSecs(
    sessionState,
    holds,
    SET1_REPS,
    SET2_REPS,
    phaseRemaining,
  );
    const finishAt = finishClockTime(Date.now(), remainingSecs);

  const renderPanel = () => {
    switch (phase) {
      case "prep":
        return <PrepTimer />;
      case "hanging":
      case "resting":
        return <HangTimer />;
      case "break": {
        const hid = currentHoldDef?.id ?? "";
        const setKey = `set${setNumber}` as "set1" | "set2" | "set3";
        return (
          <BreakTimer
            key={`break-${holdIndex}-${setNumber}`}
            setNoteValue={setNotesLive[hid]?.[setKey] ?? ""}
            onSetNoteChange={(v) =>
              setSetNotesLive((prev) => ({
                ...prev,
                [hid]: { ...prev[hid], [setKey]: v },
              }))
            }
            holdNoteValue={holdNotes[hid] ?? ""}
            onHoldNoteChange={(v) =>
              setHoldNotes((prev) => ({ ...prev, [hid]: v }))
            }
            isFailed={failedSets[hid]?.[setKey] ?? false}
            onToggleFailed={() =>
              setFailedSets((prev) => ({
                ...prev,
                [hid]: { ...prev[hid], [setKey]: !(prev[hid]?.[setKey]) },
              }))
            }
          />
        );
      }
      case "done":
        return (
          <div className="flex flex-col items-center gap-6 px-6 w-full max-w-sm">
            <div className="text-center">
              <p className="text-4xl font-bold text-white">Done!</p>
              <p className="text-gray-400 mt-1">Great work.</p>
            </div>
            {/* The final hang jumps straight here (no trailing break), so this screen
                mirrors the between-holds break: weight → failed → notes. */}
            {currentHoldDef && !currentHoldDef.skipProgression && !currentHoldDef.isRestOnly && (
              <div className="w-full bg-gray-800 rounded-xl p-3 space-y-1">
                <p className="text-gray-400 text-sm text-center">
                  Next workout — {currentHoldDef.name}
                </p>
                <WeightAdjuster
                  value={nextSessionWeight(currentHoldDef.id, 1)}
                  onDelta={(d) => {
                    adjustNextWeight(currentHoldDef.id, 1, d);
                    adjustNextWeight(currentHoldDef.id, 2, d);
                  }}
                />
              </div>
            )}
            {currentHoldDef && !currentHoldDef.isRestOnly && (() => {
              const hid = currentHoldDef.id;
              const setKey = `set${setNumber}` as "set1" | "set2" | "set3";
              const isFailed = failedSets[hid]?.[setKey] ?? false;
              const setNoteVal = setNotesLive[hid]?.[setKey] ?? "";
              const holdNoteVal = holdNotes[hid] ?? "";
              const hasLastHoldNotes = setNoteVal !== "" || holdNoteVal !== "";
              return (
                <>
                  <button
                    onClick={() =>
                      setFailedSets((prev) => ({
                        ...prev,
                        [hid]: { ...prev[hid], [setKey]: !(prev[hid]?.[setKey]) },
                      }))
                    }
                    className={`w-full py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                      isFailed
                        ? "bg-red-900/50 text-red-400 border border-red-700/50"
                        : "bg-gray-800 text-gray-600 border border-gray-700"
                    }`}
                  >
                    Failed last set
                  </button>
                  {lastHoldNotesOpen || hasLastHoldNotes ? (
                    <>
                      <textarea
                        value={setNoteVal}
                        onChange={(e) =>
                          setSetNotesLive((prev) => ({
                            ...prev,
                            [hid]: { ...prev[hid], [setKey]: e.target.value },
                          }))
                        }
                        placeholder={`Set ${setNumber} note… (optional)`}
                        rows={1}
                        className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm placeholder-gray-600 resize-none border border-gray-700 focus:outline-none focus:border-gray-500"
                      />
                      <textarea
                        value={holdNoteVal}
                        onChange={(e) =>
                          setHoldNotes((prev) => ({ ...prev, [hid]: e.target.value }))
                        }
                        placeholder={`Notes on ${currentHoldDef.name} (optional)`}
                        rows={1}
                        className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm placeholder-gray-600 resize-none border border-gray-700 focus:outline-none focus:border-gray-500"
                      />
                    </>
                  ) : (
                    <button
                      onClick={() => setLastHoldNotesOpen(true)}
                      className="w-full py-1.5 text-sm text-gray-500 bg-gray-800 rounded-lg border border-gray-700"
                    >
                      Add notes on last hold…
                    </button>
                  )}
                </>
              );
            })()}
            {workoutNotesOpen || sessionNotes !== "" ? (
              <textarea
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                placeholder="Notes on workout… (optional)"
                rows={3}
                className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm placeholder-gray-600 resize-none border border-gray-700 focus:outline-none focus:border-gray-500"
              />
            ) : (
              <button
                onClick={() => setWorkoutNotesOpen(true)}
                className="w-full py-1.5 text-sm text-gray-500 bg-gray-800 rounded-lg border border-gray-700"
              >
                Add notes on workout…
              </button>
            )}
            <button
              onClick={() => {
                saveSession(false, sessionNotes);
                advancePhase();
              }}
              className="w-full min-h-[52px] rounded-xl font-semibold bg-accent-600 active:bg-accent-500 text-white text-lg"
            >
              Save
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  const phaseLabel = () => {
    switch (phase) {
      case "prep":     return <span className="text-orange-400">Get ready</span>;
      case "hanging":  return <span className="text-green-400">Hang <span className="font-normal text-green-400/70">· rep <span className="font-num">{repIndex + 1}</span></span></span>;
      case "resting":  return <span className="text-yellow-400">Rest</span>;
      case "break":    return <span className="text-blue-400">Break</span>;
      case "done":     return <span className="text-green-400">Done</span>;
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

  const nextHoldDef = holds[holdIndex + 1];
  // The break that hands over to the main hangs already belongs to them, so the tint lifts there.
  const inWarmup =
    !!currentHoldDef &&
    isWarmup(currentHoldDef) &&
    phase !== "done" &&
    !(phase === "break" && setNumber >= numSets && nextHoldDef && !isWarmup(nextHoldDef));
  const tone = "transition-colors duration-700 motion-reduce:transition-none";
  const hudBtn =
    "h-11 flex items-center rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400";

  return (
    <div className={`h-full flex flex-col ${tone} ${inWarmup ? "bg-warmup-base" : "bg-gray-900"}`} data-warmup={inWarmup || undefined}>
      <header className={`px-4 pt-3 pb-3 ${tone} ${inWarmup ? "bg-warmup-panel" : "bg-gray-800"}`}>
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="flex items-baseline gap-1.5 text-gray-400 text-sm">
            Set
            <span className="font-num text-3xl leading-none text-white">{setNumber}</span>
            <span className="font-num text-lg leading-none text-gray-500">/ {numSets}</span>
          </p>
          <div className="flex items-center gap-2">
            {document.fullscreenEnabled && (
              <button
                onClick={toggleFullscreen}
                className={`${hudBtn} w-11 justify-center bg-white/10 text-gray-200 active:bg-white/20`}
                aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 3v3a2 2 0 0 1-2 2H3" /><path d="M21 8h-3a2 2 0 0 1-2-2V3" />
                    <path d="M3 16h3a2 2 0 0 1 2 2v3" /><path d="M16 21v-3a2 2 0 0 1 2-2h3" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M21 8V5a2 2 0 0 0-2-2h-3" />
                    <path d="M3 16v3a2 2 0 0 0 2 2h3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" />
                  </svg>
                )}
              </button>
            )}
            {phase !== "done" && (
              <button
                onClick={paused ? resumeWorkout : pauseWorkout}
                className={`${hudBtn} min-w-[88px] justify-center px-4 bg-white/10 text-gray-100 active:bg-white/20`}
                data-testid="pause-btn"
              >
                {paused ? "Resume" : "Pause"}
              </button>
            )}
            {/* Red from the start, so the one way out of a running workout is never mistaken for Pause. */}
            <button
              onClick={handleEndClick}
              className={`${hudBtn} min-w-[88px] justify-center px-4 ${
                confirming
                  ? "bg-red-600 text-white"
                  : "border border-red-500/50 text-red-300 active:bg-red-500/10"
              }`}
              data-testid="bail-btn"
            >
              {confirming ? "Confirm?" : "End"}
            </button>
          </div>
        </div>
        <div className="flex gap-1">
          {holds.map((h, i) => {
            const warm = isWarmup(h);
            return (
              <div
                key={h.id}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i > 0 && isWarmup(holds[i - 1]) && !warm ? "ml-2" : ""
                } ${
                  isHoldDone(i)
                    ? warm ? "bg-teal-300/50" : "bg-white/50"
                    : i === holdIndex
                    ? warm ? "bg-teal-200" : "bg-white"
                    : warm ? "bg-teal-700/70" : "bg-gray-600"
                }`}
              />
            );
          })}
        </div>
      </header>

      <div
        className={`border-t px-4 py-2 ${tone} ${inWarmup ? "bg-warmup-panel border-warmup-edge" : "bg-gray-800 border-gray-700"}`}
        data-testid="phase-bar"
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate text-base font-semibold">
            {phaseLabel()}
          </span>
          {phase !== "done" && phase !== "idle" && totalScheduledSecs > 0 && (
            <div
              className="flex shrink-0 items-baseline gap-4 whitespace-nowrap text-sm text-gray-400"
              data-testid="time-readout"
            >
              <span>
                <span className="font-num text-base text-white">{fmtTime(remainingSecs)}</span> left
              </span>
              <span data-testid="finish-time">
                ends <span className="font-num text-base text-white">{finishAt}</span>
              </span>
            </div>
          )}
        </div>
      </div>

      <main className={`flex-1 flex flex-col items-center ${phase === "break" ? "justify-start pt-4 pb-4" : "justify-center py-8"}`}>
        {renderPanel()}
      </main>
    </div>
  );
}
