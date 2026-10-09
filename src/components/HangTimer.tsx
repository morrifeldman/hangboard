import { HoldName } from "./HoldName";
import { repsFor } from "../data/holds";
import { usePhaseRemaining } from "../hooks/usePhaseClock";
import { useWorkoutStore } from "../store/useWorkoutStore";
import { TimerRing } from "./TimerRing";
import { isWarmup } from "../data/holds";
import { WarmupBadge } from "./WarmupBadge";
import { formatWeight } from "../lib/format";

export function HangTimer() {
  const phase = useWorkoutStore((s) => s.phase);
  const setNumber = useWorkoutStore((s) => s.setNumber);
  const repIndex = useWorkoutStore((s) => s.repIndex);
  const skipSet = useWorkoutStore((s) => s.skipSet);
  const paused = useWorkoutStore((s) => s.paused);
  const currentHold = useWorkoutStore((s) => s.currentHold);
  const effectiveWeight = useWorkoutStore((s) => s.effectiveWeight);
  const duration = useWorkoutStore((s) => s.phaseDuration);
  const pauseWorkout = useWorkoutStore((s) => s.pauseWorkout);
  const resumeWorkout = useWorkoutStore((s) => s.resumeWorkout);
  const remaining = usePhaseRemaining();

  const isHanging = phase === "hanging";
  const hold = currentHold();
  const totalReps = repsFor(hold, setNumber);

  const color = isHanging ? "stroke-green-400" : "stroke-yellow-400";
  const label = isHanging ? "Hang" : "Rest";

  return (
    <div className="flex flex-col items-center gap-3">
      {isWarmup(hold) && <WarmupBadge hold={hold} />}
      <HoldName name={hold.name} edgeClassName="text-gray-400 text-sm font-medium text-center" className="text-white font-bold text-2xl text-center" />
      <TimerRing
        remaining={remaining}
        duration={duration}
        label={label}
        color={color}
        onClick={paused ? resumeWorkout : pauseWorkout}
        paused={paused}
      />
      {!isWarmup(hold) && !hold.isRestOnly && (
        <p className="text-white font-num text-6xl leading-none" data-testid="hang-weight">
          {formatWeight(effectiveWeight(hold.id, setNumber))}
        </p>
      )}
      <div className="flex gap-2" data-testid="rep-counter">
        {Array.from({ length: totalReps }, (_, i) => {
          const done = isHanging ? i < repIndex : i <= repIndex;
          const active = isHanging && i === repIndex;
          return (
            <div
              key={i}
              className={`w-3.5 h-3.5 rounded-full transition-colors ${
                active ? "bg-green-400" : done ? "bg-white/50" : "bg-gray-600"
              }`}
            />
          );
        })}
      </div>
      <button
        onClick={skipSet}
        className="mt-2 min-h-[44px] px-5 rounded-lg bg-white/10 active:bg-white/20 text-gray-200 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
        data-testid="skip-set-btn"
      >
        Skip set
      </button>
    </div>
  );
}
