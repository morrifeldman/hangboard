import { useState } from "react";
import { useWorkoutStore } from "../store/useWorkoutStore";
import type { WorkoutId } from "../store/useWorkoutStore";
import type { HoldDefinition } from "../data/holds";
import { formatWeight, formatOffset } from "../lib/format";
import { initAudio } from "../lib/audio";
import { WeightAdjuster } from "./WeightAdjuster";

type EditKey = { holdId: string; set: 1 | 2 } | null;

function repLabel(hold: HoldDefinition): string {
  const numSets = hold.numSets ?? 2;
  if (hold.isRestOnly) return numSets > 1 ? `× ${numSets} sets` : "";
  if (hold.repsPerSet !== undefined) {
    return numSets === 1 ? `${hold.repsPerSet} rep` : `${hold.repsPerSet} rep × ${numSets} sets`;
  }
  const { set1Reps, set2Reps } = hold;
  if (set1Reps === set2Reps) return `${set1Reps} reps × ${numSets} sets`;
  return `${set1Reps} / ${set2Reps} reps`;
}

export function HomeScreen() {
  const startWorkout = useWorkoutStore((s) => s.startWorkout);
  const weights = useWorkoutStore((s) => s.weights);
  const weightsB = useWorkoutStore((s) => s.weightsB);
  const selectedWorkout = useWorkoutStore((s) => s.selectedWorkout);
  const setSelectedWorkout = useWorkoutStore((s) => s.setSelectedWorkout);
  const adjustNextWeight = useWorkoutStore((s) => s.adjustNextWeight);
  const currentHolds = useWorkoutStore((s) => s.currentHolds);

  const [editing, setEditing] = useState<EditKey>(null);

  const holds = currentHolds();
  const storedMap = selectedWorkout === "b" ? weightsB : weights;

  const handleStart = () => {
    setEditing(null);
    initAudio();
    startWorkout();
  };

  const handleSelectWorkout = (id: WorkoutId) => {
    setEditing(null);
    setSelectedWorkout(id);
  };

  const toggleEdit = (holdId: string, set: 1 | 2) => {
    setEditing((prev) =>
      prev?.holdId === holdId && prev.set === set ? null : { holdId, set }
    );
  };

  const isTestMode = new URLSearchParams(window.location.search).has("test");
  const workouts: { id: WorkoutId; label: string }[] = [
    { id: "a", label: "Repeaters" },
    { id: "b", label: "Max Hang" },
    ...(isTestMode ? [{ id: "test" as WorkoutId, label: "Test" }] : []),
  ];

  return (
    <div className="h-dvh bg-gray-900 flex flex-col">
      <header className="bg-gray-800 px-4 py-4">
        <h1 className="text-white font-bold text-2xl">Hangboard</h1>
      </header>

      {/* Workout picker */}
      <div className="px-4 pt-3 pb-1 flex gap-2">
        {workouts.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => handleSelectWorkout(id)}
            className={`flex-1 py-2.5 rounded-xl font-bold text-base transition-colors ${
              selectedWorkout === id
                ? "bg-green-600 text-white"
                : "bg-gray-800 text-gray-400"
            }`}
            data-testid={`workout-tab-${id}`}
          >
            {label}
          </button>
        ))}
      </div>

      <main className="flex-1 flex flex-col px-4 py-4 gap-2 overflow-y-auto">
        {holds.map((hold) => {
          const stored = storedMap[hold.id] ?? {
            set1: hold.defaultSet1Weight,
            set2: hold.defaultSet2Weight,
          };
          const isMultiSet = (hold.numSets ?? 2) === 2 && !hold.isRestOnly && !hold.skipProgression;
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
                <div>
                  <p className="text-white font-medium">{hold.name}</p>
                  <p className="text-gray-500 text-xs">{repLabel(hold)}</p>
                </div>
                {hold.isRestOnly ? (
                  <span className="py-0.5 px-2 text-sm tabular-nums font-semibold text-gray-200">BW</span>
                ) : (
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
                    {isMultiSet && (
                      <button
                        onClick={() => toggleEdit(hold.id, 2)}
                        className={`py-0.5 px-2 text-sm tabular-nums transition-colors ${
                          editingS2 ? "text-indigo-400" : "text-gray-500"
                        }`}
                        data-testid={`weight-${hold.id}-set2`}
                      >
                        {formatWeight(stored.set2)}
                      </button>
                    )}
                  </div>
                )}
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
                    label={isMultiSet ? "Base weight (Set 2 moves with Set 1)" : "Weight"}
                  />
                </div>
              )}

              {/* Inline editor — S2 offset only */}
              {editingS2 && isMultiSet && (
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
