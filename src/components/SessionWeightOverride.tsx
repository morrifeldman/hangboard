import { useWorkoutStore } from "../store/useWorkoutStore";
import { HOLDS } from "../data/workout";
import { WeightAdjuster } from "./WeightAdjuster";

export function SessionWeightOverride() {
  const holdIndex = useWorkoutStore((s) => s.holdIndex);
  const setNumber = useWorkoutStore((s) => s.setNumber);
  const advancePhase = useWorkoutStore((s) => s.advancePhase);
  const setSessionOverride = useWorkoutStore((s) => s.setSessionOverride);
  const effectiveWeight = useWorkoutStore((s) => s.effectiveWeight);

  const hold = HOLDS[holdIndex];
  const weight = effectiveWeight(hold.id, setNumber);

  const handleDelta = (delta: number) => {
    setSessionOverride(hold.id, setNumber, delta);
  };

  return (
    <div className="flex flex-col items-center gap-8 px-4">
      <div className="text-center">
        <p className="text-gray-400 text-sm mb-1">Set {setNumber} weight</p>
        <WeightAdjuster
          value={weight}
          onDelta={handleDelta}
          label="Adjust for this session"
        />
      </div>

      <button
        onClick={advancePhase}
        className="min-h-[56px] w-full max-w-xs rounded-xl bg-green-600 active:bg-green-500 text-white font-bold text-xl"
        data-testid="start-set-btn"
      >
        Start Set {setNumber}
      </button>
    </div>
  );
}
