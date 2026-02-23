import { useWorkoutStore } from "../store/useWorkoutStore";
import { BREAK_SECS } from "../data/workout";
import { useTimer } from "../hooks/useTimer";
import { TimerRing } from "./TimerRing";
import { WeightAdjuster } from "./WeightAdjuster";

export function BreakTimer() {
  const holdIndex = useWorkoutStore((s) => s.holdIndex);
  const setNumber = useWorkoutStore((s) => s.setNumber);
  const advancePhase = useWorkoutStore((s) => s.advancePhase);
  const skipNextSet = useWorkoutStore((s) => s.skipNextSet);
  const skipNextHold = useWorkoutStore((s) => s.skipNextHold);
  const paused = useWorkoutStore((s) => s.paused);
  const adjustNextWeight = useWorkoutStore((s) => s.adjustNextWeight);
  const effectiveWeight = useWorkoutStore((s) => s.effectiveWeight);
  const setSessionOverride = useWorkoutStore((s) => s.setSessionOverride);
  const currentHolds = useWorkoutStore((s) => s.currentHolds);
  const weights = useWorkoutStore((s) => s.weights);
  const weightsB = useWorkoutStore((s) => s.weightsB);
  const selectedWorkout = useWorkoutStore((s) => s.selectedWorkout);

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

  const storedMap = selectedWorkout === "b" ? weightsB : weights;
  const stored = storedMap[hold.id] ?? { set1: hold.defaultSet1Weight, set2: hold.defaultSet2Weight };

  const lastLabel = betweenSets ? `${hold.name} Set ${setNumber}` : hold.name;
  const upNextLabel = betweenSets ? `${hold.name} Set ${setNumber + 1}` : (nextHold?.name ?? null);

  // For isRestOnly holds the ring label becomes the exercise name
  const ringLabel = hold.isRestOnly ? hold.name.toUpperCase() : "BREAK";

  // Set 2 weight adjuster: only for 2-set holds (workout A style)
  const set2Weight = effectiveWeight(hold.id, 2);
  const handleSet2Delta = (delta: number) => {
    adjustNextWeight(hold.id, 2, delta);
    setSessionOverride(hold.id, 2, delta);
  };

  return (
    <div className="flex flex-col items-center gap-6 px-4 w-full max-w-sm">
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

      <TimerRing
        remaining={remaining}
        duration={breakDuration}
        label={ringLabel}
        color="stroke-blue-400"
      />

      {/* Set 2 weight adjuster — only for classic 2-set holds */}
      {betweenSets && numSets === 2 && (
        <div className="w-full bg-gray-800 rounded-xl p-4 space-y-3">
          <p className="text-gray-400 text-sm text-center">Set 2</p>
          <WeightAdjuster
            value={set2Weight}
            onDelta={handleSet2Delta}
          />
        </div>
      )}

      {/* Progression panels — between holds, for non-skipProgression holds */}
      {betweenHolds && !hold.skipProgression && (
        <div className="w-full bg-gray-800 rounded-xl p-4 space-y-3">
          <p className="text-gray-400 text-sm text-center">Next workout — {hold.name}</p>
          <WeightAdjuster
            value={stored.set1}
            onDelta={(d) => { adjustNextWeight(hold.id, 1, d); adjustNextWeight(hold.id, 2, d); }}
            label="Base"
          />
        </div>
      )}

      {betweenHolds && nextHold && !nextHold.isRestOnly && (() => {
        const nextStored = storedMap[nextHold.id] ?? { set1: nextHold.defaultSet1Weight, set2: nextHold.defaultSet2Weight };
        return (
          <div className="w-full bg-gray-800 rounded-xl p-4 space-y-3">
            <p className="text-gray-400 text-sm text-center">Up next — {nextHold.name}</p>
            <WeightAdjuster
              value={nextStored.set1}
              onDelta={(d) => { adjustNextWeight(nextHold.id, 1, d); adjustNextWeight(nextHold.id, 2, d); }}
              label="Base"
            />
          </div>
        );
      })()}

      <div className="flex w-full gap-3">
        <button
          onClick={advancePhase}
          className="min-h-[56px] flex-1 rounded-xl bg-gray-700 active:bg-gray-600 text-white font-bold text-lg"
          data-testid="skip-break-btn"
        >
          Skip break
        </button>
        {betweenSets && (
          <button
            onClick={skipNextSet}
            className="min-h-[56px] flex-1 rounded-xl bg-gray-700 active:bg-gray-600 text-gray-300 font-semibold text-base"
            data-testid="skip-next-set-btn"
          >
            Skip Set {setNumber + 1}
          </button>
        )}
        {betweenHolds && !hold.isRestOnly && (
          <button
            onClick={skipNextHold}
            className="min-h-[56px] flex-1 rounded-xl bg-gray-700 active:bg-gray-600 text-gray-300 font-semibold text-base"
            data-testid="skip-next-hold-btn"
          >
            Skip next hold
          </button>
        )}
      </div>
    </div>
  );
}
