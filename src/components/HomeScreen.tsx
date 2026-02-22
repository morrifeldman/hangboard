import { useState } from "react";
import { useWorkoutStore } from "../store/useWorkoutStore";
import { HOLDS } from "../data/workout";
import { formatWeight, formatOffset } from "../lib/format";
import { initAudio } from "../lib/audio";
import { WeightAdjuster } from "./WeightAdjuster";

type EditKey = { holdId: string; set: 1 | 2 } | null;

export function HomeScreen() {
  const startWorkout = useWorkoutStore((s) => s.startWorkout);
  const weights = useWorkoutStore((s) => s.weights);
  const adjustNextWeight = useWorkoutStore((s) => s.adjustNextWeight);

  const [editing, setEditing] = useState<EditKey>(null);

  const handleStart = () => {
    setEditing(null);
    initAudio();
    startWorkout();
  };

  const toggleEdit = (holdId: string, set: 1 | 2) => {
    setEditing((prev) =>
      prev?.holdId === holdId && prev.set === set ? null : { holdId, set }
    );
  };

  return (
    <div className="h-dvh bg-gray-900 flex flex-col">
      <header className="bg-gray-800 px-4 py-4">
        <h1 className="text-white font-bold text-2xl">Hangboard</h1>
      </header>

      <main className="flex-1 flex flex-col px-4 py-4 gap-2 overflow-y-auto">
{HOLDS.map((hold) => {
          const stored = weights[hold.id] ?? {
            set1: hold.defaultSet1Weight,
            set2: hold.defaultSet2Weight,
          };
          const editingS1 = editing?.holdId === hold.id && editing.set === 1;
          const editingS2 = editing?.holdId === hold.id && editing.set === 2;

          return (
            <div
              key={hold.id}
              className="bg-gray-800 rounded-xl overflow-hidden"
              data-testid={`hold-row-${hold.id}`}
            >
              {/* Row header */}
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="text-white font-medium">{hold.name}</span>
                <div className="flex flex-col items-end">
                  <button
                    onClick={() => toggleEdit(hold.id, 1)}
                    className={`py-0.5 px-2 text-sm tabular-nums font-semibold transition-colors ${
                      editingS1 ? "text-indigo-400" : "text-gray-200"
                    }`}
                    data-testid={`weight-${hold.id}-set1`}
                  >
                    {formatWeight(stored.set1)}
                  </button>
                  <button
                    onClick={() => toggleEdit(hold.id, 2)}
                    className={`py-0.5 px-2 text-sm tabular-nums transition-colors ${
                      editingS2 ? "text-indigo-400" : "text-gray-500"
                    }`}
                    data-testid={`weight-${hold.id}-set2`}
                  >
                    {formatWeight(stored.set2)}
                  </button>
                </div>
              </div>

              {/* Inline editor — S1 moves both sets together */}
              {editingS1 && (
                <div className="border-t border-gray-700 px-4 py-4">
                  <WeightAdjuster
                    value={stored.set1}
                    onDelta={(d) => {
                      adjustNextWeight(hold.id, 1, d);
                      adjustNextWeight(hold.id, 2, d);
                    }}
                    label="Base weight (Set 2 moves with Set 1)"
                  />
                </div>
              )}

              {/* Inline editor — S2 only */}
              {editingS2 && (
                <div className="border-t border-gray-700 px-4 py-4">
                  <WeightAdjuster
                    value={stored.set2 - stored.set1}
                    onDelta={(d) => adjustNextWeight(hold.id, 2, d)}
                    label="Set 2 offset from Set 1"
                    formatValue={formatOffset}
                  />
                </div>
              )}
            </div>
          );
        })}
      </main>

      <div className="px-4 py-6">
        <button
          onClick={handleStart}
          className="min-h-[64px] w-full rounded-2xl bg-green-600 active:bg-green-500 text-white font-bold text-2xl"
          data-testid="start-workout-btn"
        >
          Start Workout
        </button>
      </div>
    </div>
  );
}
