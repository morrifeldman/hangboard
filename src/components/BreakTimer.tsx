import { useWorkoutStore } from "../store/useWorkoutStore";
import { HOLDS, BREAK_SECS } from "../data/workout";
import { useTimer } from "../hooks/useTimer";
import { TimerRing } from "./TimerRing";
import { WeightAdjuster } from "./WeightAdjuster";
import { formatOffset } from "../lib/format";

export function BreakTimer() {
  const holdIndex = useWorkoutStore((s) => s.holdIndex);
  const setNumber = useWorkoutStore((s) => s.setNumber);
  const advancePhase = useWorkoutStore((s) => s.advancePhase);
  const adjustNextWeight = useWorkoutStore((s) => s.adjustNextWeight);
  const effectiveWeight = useWorkoutStore((s) => s.effectiveWeight);
  const setSessionOverride = useWorkoutStore((s) => s.setSessionOverride);
  const weights = useWorkoutStore((s) => s.weights);

  const hold = HOLDS[holdIndex];
  const nextHold = HOLDS[holdIndex + 1];

  const { remaining } = useTimer({
    duration: BREAK_SECS,
    onExpire: advancePhase,
  });

  // Between set 1 and set 2 — show upcoming set 2 weight
  const betweenSets = setNumber === 1;

  // Between set 2 and next hold — show next-workout progression
  const betweenHolds = setNumber === 2;
  const stored = weights[hold.id] ?? { set1: hold.defaultSet1Weight, set2: hold.defaultSet2Weight };
  const set2Weight = effectiveWeight(hold.id, 2);

  const handleSet2Delta = (delta: number) => {
    adjustNextWeight(hold.id, 2, delta);
    setSessionOverride(hold.id, 2, delta);
  };

  return (
    <div className="flex flex-col items-center gap-6 px-4 w-full max-w-sm">
      <TimerRing
        remaining={remaining}
        duration={BREAK_SECS}
        label="BREAK"
        color="stroke-blue-400"
      />

      {betweenSets && (
        <div className="w-full bg-gray-800 rounded-xl p-4 space-y-3">
          <p className="text-gray-400 text-sm text-center">Set 2 weight</p>
          <WeightAdjuster
            value={set2Weight}
            onDelta={handleSet2Delta}
          />
        </div>
      )}

      {betweenHolds && !hold.skipProgression && (
        <div className="w-full bg-gray-800 rounded-xl p-4 space-y-4">
          <p className="text-gray-400 text-sm text-center">Next workout — {hold.name}</p>
          <WeightAdjuster
            value={stored.set1}
            onDelta={(d) => { adjustNextWeight(hold.id, 1, d); adjustNextWeight(hold.id, 2, d); }}
            label="Base (S1+S2 move together)"
          />
          <WeightAdjuster
            value={stored.set2 - stored.set1}
            onDelta={(d) => adjustNextWeight(hold.id, 2, d)}
            label="Set 2 offset"
            formatValue={formatOffset}
          />
        </div>
      )}

      {betweenHolds && nextHold && (() => {
        const nextStored = weights[nextHold.id] ?? { set1: nextHold.defaultSet1Weight, set2: nextHold.defaultSet2Weight };
        return (
          <div className="w-full bg-gray-800 rounded-xl p-4 space-y-4">
            <p className="text-gray-400 text-sm text-center">Up next — {nextHold.name}</p>
            <WeightAdjuster
              value={nextStored.set1}
              onDelta={(d) => { adjustNextWeight(nextHold.id, 1, d); adjustNextWeight(nextHold.id, 2, d); }}
              label="Base (S1+S2 move together)"
            />
            <WeightAdjuster
              value={nextStored.set2 - nextStored.set1}
              onDelta={(d) => adjustNextWeight(nextHold.id, 2, d)}
              label="Set 2 offset"
              formatValue={formatOffset}
            />
          </div>
        );
      })()}

      <button
        onClick={advancePhase}
        className="min-h-[56px] w-full rounded-xl bg-gray-700 active:bg-gray-600 text-white font-bold text-lg"
        data-testid="skip-break-btn"
      >
        Skip
      </button>
    </div>
  );
}
