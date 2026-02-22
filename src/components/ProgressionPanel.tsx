import { useWorkoutStore } from "../store/useWorkoutStore";
import { HOLDS } from "../data/workout";
import { WeightAdjuster } from "./WeightAdjuster";

export function ProgressionPanel() {
  const holdIndex = useWorkoutStore((s) => s.holdIndex);
  const advancePhase = useWorkoutStore((s) => s.advancePhase);
  const adjustNextWeight = useWorkoutStore((s) => s.adjustNextWeight);
  const weights = useWorkoutStore((s) => s.weights);

  const hold = HOLDS[holdIndex];
  const stored = weights[hold.id] ?? { set1: hold.defaultSet1Weight, set2: hold.defaultSet2Weight };

  return (
    <div className="flex flex-col items-center gap-8 px-4">
      <div className="text-center">
        <h2 className="text-white font-bold text-xl mb-1">Set Complete!</h2>
        <p className="text-gray-400 text-sm">Adjust next workout weights for {hold.name}</p>
      </div>

      <div className="w-full max-w-sm bg-gray-800 rounded-xl p-4 space-y-6">
        <WeightAdjuster
          value={stored.set1}
          onDelta={(d) => adjustNextWeight(hold.id, 1, d)}
          label="Set 1 (next workout)"
        />
        <WeightAdjuster
          value={stored.set2}
          onDelta={(d) => adjustNextWeight(hold.id, 2, d)}
          label="Set 2 (next workout)"
        />
      </div>

      <button
        onClick={advancePhase}
        className="min-h-[56px] w-full max-w-xs rounded-xl bg-indigo-600 active:bg-indigo-500 text-white font-bold text-xl"
        data-testid="next-hold-btn"
      >
        Next Hold
      </button>
    </div>
  );
}
