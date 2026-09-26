import { useState, useEffect, useMemo } from "react";
import { useWorkoutStore } from "../store/useWorkoutStore";
import type { WorkoutId } from "../store/useWorkoutStore";
import { isWarmup } from "../data/holds";
import type { HoldDefinition } from "../data/holds";
import { SectionLabel } from "./WarmupBadge";
import { formatWeight, formatOffset } from "../lib/format";
import { HANG_SECS, REST_SECS, BREAK_SECS, SET1_REPS, SET2_REPS } from "../data/workout";
import { initAudio } from "../lib/audio";
import { WeightAdjuster } from "./WeightAdjuster";
import { getSessions } from "../lib/history";
import { totalWorkoutSecs } from "../lib/workoutTime";
import type { SessionRecord } from "../lib/history";
import { overviewDelta } from "../lib/weightCues";
import { IS_TEST_MODE } from "../lib/testMode";

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

/** "vs last workout" cue on the setup overview: ▲ advancing, ▼ backing off. */
function DeltaChip({ delta }: { delta: number | null }) {
  if (!delta) return null;
  const up = delta > 0;
  return (
    <span
      className={`text-xs font-semibold tabular-nums ${up ? "text-green-400" : "text-red-400"}`}
    >
      {up ? "▲" : "▼"}{formatOffset(delta)}
    </span>
  );
}

function repLabel(hold: HoldDefinition): string {
  const numSets = hold.numSets ?? 2;
  if (hold.isRestOnly) return numSets > 1 ? `× ${numSets} sets` : "";
  if (hold.repsPerSet !== undefined) {
    const reps = `${hold.repsPerSet} ${hold.repsPerSet === 1 ? "rep" : "reps"}`;
    return numSets === 1 ? reps : `${reps} × ${numSets} sets`;
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
  const [warmupOpen, setWarmupOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);

  useEffect(() => {
    getSessions().then(setSessions).catch(() => {});
  }, []);

  const holds = currentHolds();
  const warmupHolds = holds.filter(isWarmup);
  const mainHolds = holds.filter((h) => !isWarmup(h));
  const mainInc = mainHolds.find((h) => h.setIncrement)?.setIncrement;
  const holdSummary = (hold: HoldDefinition) =>
    [repLabel(hold), timingLabel(hold)].filter(Boolean).join(" · ");
  // A lone warm-up hold's timing goes on the section line instead of repeating under the hold.
  // Nothing in the warm-up is adjustable, so a long one folds away and leaves room for the main hangs.
  const warmupFolds = warmupHolds.length > 1;
  const warmupMins = Math.round(totalWorkoutSecs(warmupHolds, SET1_REPS, SET2_REPS) / 60);
  const totalMins = Math.round(totalWorkoutSecs(holds, SET1_REPS, SET2_REPS) / 60);
  const mainDetail =
    selectedWorkout === "repeaters"
      ? `${SET1_REPS}/${SET2_REPS} reps · ${fmtSecs(HANG_SECS)} hang · ${fmtSecs(REST_SECS)} rest · ${fmtSecs(BREAK_SECS)} break`
      : mainInc ? `+${mainInc} lb per set` : undefined;
  const storedMap = selectedWorkout === "max-hang" ? weightsB : weights;

  // Most recent hangboard session of this type (any completion state) — baseline for the
  // in-session "vs last time" cue and the per-hold ▲/▼ chips below.
  const lastSession = useMemo(
    () => sessions.find((s) => s.workoutType === selectedWorkout && !s.gymData),
    [sessions, selectedWorkout],
  );
  const lastHoldMap = useMemo(
    () => new Map(lastSession?.holds.map((h) => [h.holdId, h]) ?? []),
    [lastSession],
  );

  const handleStart = () => {
    setEditing(null);
    initAudio();
    const lastWeights = lastSession
      ? Object.fromEntries(
          lastSession.holds.map((h) => [
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

  const isTestMode = IS_TEST_MODE;
  const workouts: { id: WorkoutId; label: string }[] = [
    { id: "repeaters", label: "Repeaters" },
    { id: "max-hang", label: "Max Hang" },
    ...(isTestMode ? [{ id: "test" as WorkoutId, label: "Test" }] : []),
  ];

  return (
    <div className="flex flex-col gap-2">
      {/* Subtype picker */}
      <div className="flex gap-1 rounded-xl bg-gray-800 p-1" role="group" aria-label="Hangboard workout">
        {workouts.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => handleSelectWorkout(id)}
            aria-pressed={selectedWorkout === id}
            className={`min-h-[40px] flex-1 rounded-lg text-[15px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 ${
              selectedWorkout === id
                ? "bg-gray-600 text-white"
                : "text-gray-400 active:bg-gray-700"
            }`}
            data-testid={`workout-tab-${id}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Start sits above the holds so it's on screen without scrolling; the weights below are for checking, not a step you must pass. */}
      <button
        onClick={handleStart}
        className="mt-1 flex w-full items-center gap-4 rounded-2xl bg-accent-500 active:bg-accent-400 py-3 pl-5 pr-3 text-left text-gray-950 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-300 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
        data-testid="start-workout-btn"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-xl font-bold leading-tight">Start workout</span>
          <span className="block text-sm font-medium text-gray-950/60">
            {mainHolds.length} holds · about {totalMins} min
          </span>
        </span>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gray-950 text-accent-400" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="ml-0.5">
            <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z" />
          </svg>
        </span>
      </button>

      {warmupHolds.length > 0 && (
        <>
          <div className="mt-2 shrink-0 overflow-hidden rounded-2xl border-l-4 border-teal-400/70 bg-teal-400/[0.07]">
            <button
              type="button"
              onClick={() => setWarmupOpen((o) => !o)}
              disabled={!warmupFolds}
              aria-expanded={warmupFolds ? warmupOpen : undefined}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
              data-testid={warmupFolds ? "warmup-toggle" : `hold-row-${warmupHolds[0].id}`}
            >
              <div className="min-w-0">
                <p className="text-teal-200 font-semibold">Warm-up</p>
                <p className="text-xs text-teal-100/50">
                  {warmupFolds
                    ? `${warmupHolds.length} holds · about ${warmupMins} min`
                    : `${warmupHolds[0].name} · ${holdSummary(warmupHolds[0])}`}
                </p>
              </div>
              {!warmupFolds && (
                <span className="font-num text-base text-teal-100/60">BW</span>
              )}
              {warmupFolds && (
                <svg
                  width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                  className={`shrink-0 text-teal-300/70 transition-transform motion-reduce:transition-none ${warmupOpen ? "rotate-180" : ""}`}
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              )}
            </button>
            {warmupFolds && warmupOpen && (
              <div className="divide-y divide-teal-400/10 border-t border-teal-400/10">
                {warmupHolds.map((hold) => (
                  <div
                    key={hold.id}
                    className="px-4 py-2.5 flex items-center justify-between gap-3"
                    data-testid={`hold-row-${hold.id}`}
                  >
                    <div className="min-w-0">
                      <p className="text-gray-200 text-sm font-medium">{hold.name}</p>
                      <p className="text-gray-500 text-xs">{holdSummary(hold)}</p>
                    </div>
                    <span className="font-num text-base text-teal-100/60">BW</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <SectionLabel detail={mainDetail}>Main hangs</SectionLabel>
        </>
      )}

      <div className="shrink-0 overflow-hidden rounded-2xl bg-gray-800 divide-y divide-gray-700/60">
      {mainHolds.map((hold) => {
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
        const lastHold = lastHoldMap.get(hold.id);
        const delta1 = hold.isRestOnly || hold.skipProgression ? null : overviewDelta(stored.set1, lastHold, 1);
        const delta2 = isMultiSet && !is3Set ? overviewDelta(stored.set2, lastHold, 2) : null;
        const weightBtn =
          "min-h-[40px] -my-1 px-2 flex items-center gap-1.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400";

        return (
          <div
            key={hold.id}
            className="shrink-0"
            data-testid={`hold-row-${hold.id}`}
          >
            <div className="pl-4 pr-2 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-white font-medium">{hold.name}</p>
                {selectedWorkout !== "repeaters" && (
                  <p className="text-gray-400 text-xs">{repLabel(hold)}</p>
                )}
                {selectedWorkout !== "repeaters" && timingLabel(hold) && (
                  <p className="text-gray-500 text-xs">{timingLabel(hold)}</p>
                )}
              </div>
              {hold.isRestOnly ? (
                <span className="px-2 font-num text-2xl text-gray-300">BW</span>
              ) : (
                <div className="flex shrink-0 items-baseline">
                  <button
                    onClick={() => toggleEdit(hold.id, 1)}
                    aria-expanded={editingS1}
                    className={`${weightBtn} font-num text-2xl ${editingS1 ? "text-accent-400" : "text-white"}`}
                    data-testid={`weight-${hold.id}-set1`}
                  >
                    <DeltaChip delta={delta1} />
                    {is3Set ? (
                      <span className="flex items-baseline gap-1.5">
                        {formatWeight(stored.set1)}
                        <span className="text-base font-normal text-gray-500" aria-hidden="true">→</span>
                        {formatWeight(stored.set1 + inc)}
                        <span className="text-base font-normal text-gray-500" aria-hidden="true">→</span>
                        {formatWeight(stored.set1 + inc * 2)}
                      </span>
                    ) : (
                      formatWeight(stored.set1)
                    )}
                  </button>
                  {isMultiSet && !is3Set && (
                    <button
                      onClick={() => toggleEdit(hold.id, 2)}
                      aria-expanded={editingS2}
                      className={`${weightBtn} font-num text-lg ${editingS2 ? "text-accent-400" : "text-gray-400"}`}
                      data-testid={`weight-${hold.id}-set2`}
                    >
                      <DeltaChip delta={delta2} />
                      {formatWeight(stored.set2)}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Inline editor — S1 moves both sets together */}
            {editingS1 && (
              <div ref={scrollCardIntoViewRef} className="border-t border-gray-700/60 bg-gray-900/40 px-4 py-4">
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
              <div ref={scrollCardIntoViewRef} className="border-t border-gray-700/60 bg-gray-900/40 px-4 py-4">
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
      </div>

    </div>
  );
}
