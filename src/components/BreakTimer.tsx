import { useState } from "react";
import { useWorkoutStore } from "../store/useWorkoutStore";
import { BREAK_SECS } from "../data/workout";
import { useTimer } from "../hooks/useTimer";
import { WeightAdjuster } from "./WeightAdjuster";

type Props = {
  setNoteValue: string;
  onSetNoteChange: (v: string) => void;
  holdNoteValue: string;
  onHoldNoteChange: (v: string) => void;
  isFailed: boolean;
  onToggleFailed: () => void;
};

export function BreakTimer({ setNoteValue, onSetNoteChange, holdNoteValue, onHoldNoteChange, isFailed, onToggleFailed }: Props) {
  const holdIndex = useWorkoutStore((s) => s.holdIndex);
  const setNumber = useWorkoutStore((s) => s.setNumber);
  const advancePhase = useWorkoutStore((s) => s.advancePhase);
  const skipNextSet = useWorkoutStore((s) => s.skipNextSet);
  const skipNextHold = useWorkoutStore((s) => s.skipNextHold);
  const paused = useWorkoutStore((s) => s.paused);
  const pauseWorkout = useWorkoutStore((s) => s.pauseWorkout);
  const resumeWorkout = useWorkoutStore((s) => s.resumeWorkout);
  const adjustNextWeight = useWorkoutStore((s) => s.adjustNextWeight);
  const effectiveWeight = useWorkoutStore((s) => s.effectiveWeight);
  const setSessionOverride = useWorkoutStore((s) => s.setSessionOverride);
  const currentHolds = useWorkoutStore((s) => s.currentHolds);
  const weights = useWorkoutStore((s) => s.weights);
  const weightsB = useWorkoutStore((s) => s.weightsB);
  const selectedWorkout = useWorkoutStore((s) => s.selectedWorkout);

  const [notesExpanded, setNotesExpanded] = useState(false);

  const holds = currentHolds();
  const hold = holds[holdIndex];
  const nextHold = holds[holdIndex + 1];
  const numSets = hold.numSets ?? 2;
  const breakDuration = hold.breakSecs ?? BREAK_SECS;

  const { remaining } = useTimer({
    duration: breakDuration,
    running: !paused,
    onExpire: advancePhase,
  });

  // Between sets of the same hold (not the last set yet)
  const betweenSets = setNumber < numSets;
  // After the last set — between this hold and the next
  const betweenHolds = !betweenSets;

  const storedMap = selectedWorkout === "max-hang" ? weightsB : weights;
  const stored = storedMap[hold.id] ?? { set1: hold.defaultSet1Weight, set2: hold.defaultSet2Weight };

  const lastLabel = betweenSets ? `${hold.name} Set ${setNumber}` : hold.name;
  const upNextLabel = betweenSets ? `${hold.name} Set ${setNumber + 1}` : (nextHold?.name ?? null);

  // For isRestOnly holds the label becomes the exercise name
  const barLabel = hold.isRestOnly ? hold.name.toUpperCase() : "BREAK";

  // Set 2 weight adjuster: only for 2-set holds (workout A style)
  const set2Weight = effectiveWeight(hold.id, 2);
  const handleSet2Delta = (delta: number) => {
    adjustNextWeight(hold.id, 2, delta);
    setSessionOverride(hold.id, 2, delta);
  };

  const progress = breakDuration > 0 ? Math.max(0, Math.min(1, remaining / breakDuration)) : 0;
  const hasNotes = setNoteValue !== "" || holdNoteValue !== "";

  return (
    <div className="flex flex-col items-center gap-3 px-4 w-full max-w-sm">
      <div className="w-full flex justify-between">
        <div>
          <p className="text-gray-500 text-xs uppercase tracking-wide">Last</p>
          <p className="text-white font-semibold">{lastLabel}</p>
        </div>
        {upNextLabel && (
          <div className="text-right">
            <p className="text-gray-500 text-xs uppercase tracking-wide">Up next</p>
            <p className="text-white font-semibold">{upNextLabel}</p>
          </div>
        )}
      </div>

      {/* Compact bar timer */}
      <div
        className={`flex flex-col items-center gap-1 w-full ${paused ? "" : "cursor-pointer"}`}
        onClick={paused ? resumeWorkout : pauseWorkout}
      >
        {paused ? (
          <div className="flex flex-col items-center">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="white" className="opacity-80">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
            <span className="text-sm font-medium text-gray-400">PAUSED</span>
          </div>
        ) : (
          <>
            <span className="text-5xl font-bold tabular-nums text-white">
              {Math.ceil(remaining)}
            </span>
            <span className="text-sm font-medium text-gray-400">{barLabel}</span>
          </>
        )}
        <div className="w-full bg-gray-700 rounded-full h-1.5 mt-1">
          <div
            className="bg-blue-400 h-1.5 rounded-full transition-all duration-100"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>

      {/* Set 2 weight adjuster — only for classic 2-set holds */}
      {betweenSets && numSets === 2 && !hold.skipProgression && (
        <div className="w-full bg-gray-800 rounded-xl p-3 space-y-1">
          <p className="text-gray-400 text-sm text-center">Set 2</p>
          <WeightAdjuster
            value={set2Weight}
            onDelta={handleSet2Delta}
          />
        </div>
      )}

      {/* Progression panels — between holds, for non-skipProgression holds */}
      {betweenHolds && !hold.skipProgression && (
        <div className="w-full bg-gray-800 rounded-xl p-3 space-y-1">
          <p className="text-gray-400 text-sm text-center">Next workout — {hold.name}</p>
          <WeightAdjuster
            value={stored.set1}
            onDelta={(d) => { adjustNextWeight(hold.id, 1, d); adjustNextWeight(hold.id, 2, d); }}
          />
        </div>
      )}

      {betweenHolds && nextHold && !nextHold.isRestOnly && (() => {
        const nextStored = storedMap[nextHold.id] ?? { set1: nextHold.defaultSet1Weight, set2: nextHold.defaultSet2Weight };
        return (
          <div className="w-full bg-gray-800 rounded-xl p-3 space-y-1">
            <p className="text-gray-400 text-sm text-center">Up next — {nextHold.name}</p>
            <WeightAdjuster
              value={nextStored.set1}
              onDelta={(d) => { adjustNextWeight(nextHold.id, 1, d); adjustNextWeight(nextHold.id, 2, d); }}
            />
          </div>
        );
      })()}

      {!hold.isRestOnly && (
        <button
          onClick={onToggleFailed}
          className={`w-full py-1.5 rounded-lg text-sm font-semibold transition-colors ${
            isFailed
              ? "bg-red-900/50 text-red-400 border border-red-700/50"
              : "bg-gray-800 text-gray-600 border border-gray-700"
          }`}
        >
          Failed last set
        </button>
      )}

      {/* Collapsible notes */}
      {notesExpanded || hasNotes ? (
        <>
          <textarea
            value={setNoteValue}
            onChange={(e) => onSetNoteChange(e.target.value)}
            placeholder={betweenSets ? `Set 1 note… (optional)` : `Set 2 note… (optional)`}
            rows={1}
            className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm
                       placeholder-gray-600 resize-none border border-gray-700
                       focus:outline-none focus:border-gray-500"
          />
          {betweenHolds && (
            <textarea
              value={holdNoteValue}
              onChange={(e) => onHoldNoteChange(e.target.value)}
              placeholder={`Notes on ${hold.name} (optional)`}
              rows={1}
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm
                         placeholder-gray-600 resize-none border border-gray-700
                         focus:outline-none focus:border-gray-500"
            />
          )}
        </>
      ) : (
        <button
          onClick={() => setNotesExpanded(true)}
          className="w-full py-1.5 text-sm text-gray-500 bg-gray-800 rounded-lg border border-gray-700"
        >
          Add notes...
        </button>
      )}

      <div className="flex w-full gap-3">
        <button
          onClick={advancePhase}
          className="min-h-[44px] flex-1 rounded-xl bg-gray-700 active:bg-gray-600 text-white font-bold text-lg"
          data-testid="skip-break-btn"
        >
          Skip break
        </button>
        {betweenSets && (
          <button
            onClick={skipNextSet}
            className="min-h-[44px] flex-1 rounded-xl bg-gray-700 active:bg-gray-600 text-gray-300 font-semibold text-base"
            data-testid="skip-next-set-btn"
          >
            Skip Set {setNumber + 1}
          </button>
        )}
        {betweenHolds && !hold.isRestOnly && (
          <button
            onClick={skipNextHold}
            className="min-h-[44px] flex-1 rounded-xl bg-gray-700 active:bg-gray-600 text-gray-300 font-semibold text-base"
            data-testid="skip-next-hold-btn"
          >
            Skip next hold
          </button>
        )}
      </div>
    </div>
  );
}
