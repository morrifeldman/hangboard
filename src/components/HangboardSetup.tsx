import { useState, useEffect } from "react";
import { useWorkoutStore } from "../store/useWorkoutStore";
import type { WorkoutId } from "../store/useWorkoutStore";
import type { HoldDefinition } from "../data/holds";
import { formatWeight, formatOffset } from "../lib/format";
import { HANG_SECS, REST_SECS, BREAK_SECS, SET1_REPS, SET2_REPS } from "../data/workout";
import { initAudio } from "../lib/audio";
import { WeightAdjuster } from "./WeightAdjuster";
import { getSessions } from "../lib/history";
import type { SessionRecord } from "../lib/history";
import { buildTrend } from "../lib/progressData";
import type { TrendPoint } from "../lib/progressData";

type EditKey = { holdId: string; set: 1 | 2 } | null;

/** Scroll the expanded card into view, centering it in the scroll area */
function scrollCardIntoViewRef(el: HTMLDivElement | null) {
  if (el) {
    const card = el.closest<HTMLElement>("[data-testid^='hold-row-']");
    if (card) {
      requestAnimationFrame(() => {
        card.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  }
}

// ─── SparkLine ────────────────────────────────────────────────────────────────

function SparkLine({ points }: { points: TrendPoint[] }) {
  if (points.length < 2) return <div className="w-[50px] h-5" />;

  const weights = points.map((p) => p.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;
  const W = 50;
  const H = 20;
  const pad = 2;

  const coords = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * (W - pad * 2);
    const y = H - pad - ((p.weight - min) / range) * (H - pad * 2);
    return `${x},${y}`;
  });

  const lastWeight = weights[weights.length - 1];
  const firstWeight = weights[0];
  const color = lastWeight >= firstWeight ? "#22c55e" : "#6366f1";

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-[50px] h-5"
      aria-hidden="true"
    >
      <polyline
        points={coords.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

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

function fmtSecs(s: number): string {
  return s >= 60 && s % 60 === 0 ? `${s / 60}m` : `${s}s`;
}

function timingLabel(hold: HoldDefinition): string {
  const hang = hold.hangSecs ?? HANG_SECS;
  const rest = hold.restSecs ?? REST_SECS;
  const brk = hold.breakSecs ?? BREAK_SECS;
  const reps = hold.repsPerSet ?? hold.set1Reps;
  if (hold.isRestOnly) return `${fmtSecs(brk)} break`;
  const parts: string[] = [`${fmtSecs(hang)} hang`];
  if (reps > 1) parts.push(`${fmtSecs(rest)} rest`);
  parts.push(`${fmtSecs(brk)} break`);
  return parts.join(" · ");
}

/**
 * Hangboard workout setup — subtype tabs (Repeaters / Max Hang / Test),
 * per-hold weight review/edit, and the Start button that drops into the
 * guided timer. Self-contained content block: renders inside a scroll
 * container (the Workout tab), no header/nav of its own.
 */
export function HangboardSetup() {
  const startWorkout = useWorkoutStore((s) => s.startWorkout);
  const weights = useWorkoutStore((s) => s.weights);
  const weightsB = useWorkoutStore((s) => s.weightsB);
  const selectedWorkout = useWorkoutStore((s) => s.selectedWorkout);
  const setSelectedWorkout = useWorkoutStore((s) => s.setSelectedWorkout);
  const adjustNextWeight = useWorkoutStore((s) => s.adjustNextWeight);
  const currentHolds = useWorkoutStore((s) => s.currentHolds);

  const [editing, setEditing] = useState<EditKey>(null);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);

  useEffect(() => {
    getSessions().then(setSessions).catch(() => {});
  }, []);

  const holds = currentHolds();
  const storedMap = selectedWorkout === "max-hang" ? weightsB : weights;

  const handleStart = () => {
    setEditing(null);
    initAudio();
    // Most recent hangboard session of this type (any completion state) — baseline for the
    // in-session "vs last time" weight cue.
    const last = sessions.find((s) => s.workoutType === selectedWorkout && !s.gymData);
    const lastWeights = last
      ? Object.fromEntries(
          last.holds.map((h) => [
            h.holdId,
            {
              set1: h.set1.weight,
              set2: h.set2?.weight ?? h.set1.weight,
              ...(h.set3 ? { set3: h.set3.weight } : {}),
            },
          ]),
        )
      : undefined;
    startWorkout(lastWeights);
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
    { id: "repeaters", label: "Repeaters" },
    { id: "max-hang", label: "Max Hang" },
    ...(isTestMode ? [{ id: "test" as WorkoutId, label: "Test" }] : []),
  ];

  return (
    <div className="flex flex-col gap-2">
      {/* Subtype picker */}
      <div className="flex gap-2">
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

      {selectedWorkout === "repeaters" && (
        <p className="text-gray-600 text-xs px-1">
          {SET1_REPS}/{SET2_REPS} reps · {fmtSecs(HANG_SECS)} hang · {fmtSecs(REST_SECS)} rest · {fmtSecs(BREAK_SECS)} break
        </p>
      )}

      {holds.map((hold) => {
        const stored = storedMap[hold.id] ?? {
          set1: hold.defaultSet1Weight,
          set2: hold.defaultSet2Weight,
        };
        const nSets = hold.numSets ?? 2;
        const isMultiSet = nSets >= 2 && !hold.isRestOnly && !hold.skipProgression;
        const is3Set = nSets >= 3 && !hold.isRestOnly && !hold.skipProgression;
        const inc = hold.setIncrement ?? 0;
        const editingS1 = editing?.holdId === hold.id && editing.set === 1;
        const editingS2 = editing?.holdId === hold.id && editing.set === 2;
        const sparkPoints = buildTrend(sessions, hold.id, selectedWorkout === "max-hang" ? "max-hang" : "repeaters");

        return (
          <div
            key={hold.id}
            className="bg-gray-800 rounded-xl overflow-hidden shrink-0"
            data-testid={`hold-row-${hold.id}`}
          >
            {/* Row header */}
            <div className="px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-white font-medium">{hold.name}</p>
                {selectedWorkout !== "repeaters" && (
                  <p className="text-gray-500 text-xs">{repLabel(hold)}</p>
                )}
                {selectedWorkout !== "repeaters" && timingLabel(hold) && (
                  <p className="text-gray-600 text-xs">{timingLabel(hold)}</p>
                )}
              </div>
              {hold.isRestOnly ? (
                <span className="py-0.5 px-2 text-sm tabular-nums font-semibold text-gray-200">BW</span>
              ) : (
                <div className="flex items-center gap-2">
                  <SparkLine points={sparkPoints} />
                  <div className="flex flex-col items-end">
                    <button
                      onClick={() => toggleEdit(hold.id, 1)}
                      className={`py-0.5 px-2 text-sm tabular-nums font-semibold transition-colors ${
                        editingS1 ? "text-indigo-400" : "text-gray-200"
                      }`}
                      data-testid={`weight-${hold.id}-set1`}
                    >
                      {is3Set
                        ? `${formatWeight(stored.set1)} → ${formatWeight(stored.set1 + inc)} → ${formatWeight(stored.set1 + inc * 2)}`
                        : formatWeight(stored.set1)}
                    </button>
                    {isMultiSet && !is3Set && (
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
                </div>
              )}
            </div>

            {/* Inline editor — S1 moves both sets together */}
            {editingS1 && (
              <div ref={scrollCardIntoViewRef} className="border-t border-gray-700 px-4 py-4">
                <WeightAdjuster
                  value={stored.set1}
                  onDelta={(d) => {
                    adjustNextWeight(hold.id, 1, d);
                    adjustNextWeight(hold.id, 2, d);
                  }}
                  label={is3Set ? `Base weight (+${inc} lb per set)` : isMultiSet ? "Base weight (Set 2 moves with Set 1)" : "Weight"}
                />
              </div>
            )}

            {/* Inline editor — S2 offset only */}
            {editingS2 && isMultiSet && (
              <div ref={scrollCardIntoViewRef} className="border-t border-gray-700 px-4 py-4">
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

      <div className="shrink-0 pt-4 pb-2">
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
