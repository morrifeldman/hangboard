import { HoldName } from "./HoldName";
import { useWorkoutStore } from "../store/useWorkoutStore";
import { usePhaseRemaining } from "../hooks/usePhaseClock";
import { TimerRing } from "./TimerRing";
import { formatWeight } from "../lib/format";
import { isWarmup } from "../data/holds";
import { WarmupBadge } from "./WarmupBadge";

export function PrepTimer() {
  const setNumber = useWorkoutStore((s) => s.setNumber);
  const effectiveWeight = useWorkoutStore((s) => s.effectiveWeight);
  const paused = useWorkoutStore((s) => s.paused);
  const currentHold = useWorkoutStore((s) => s.currentHold);
  const prepDuration = useWorkoutStore((s) => s.phaseDuration);
  const pauseWorkout = useWorkoutStore((s) => s.pauseWorkout);
  const resumeWorkout = useWorkoutStore((s) => s.resumeWorkout);
  const remaining = usePhaseRemaining();

  const hold = currentHold();
  const warmup = isWarmup(hold);
  const weight = effectiveWeight(hold.id, setNumber);

  return (
    <div className="flex flex-col items-center gap-3">
      {warmup && <WarmupBadge hold={hold} />}
      <HoldName name={hold.name} edgeClassName="text-gray-400 text-sm font-medium text-center" className="text-white font-bold text-2xl text-center" data-testid="hold-name" />
      <TimerRing
        remaining={remaining}
        duration={prepDuration}
        label="Get ready"
        color="stroke-orange-400"
        onClick={paused ? resumeWorkout : pauseWorkout}
        paused={paused}
      />
      {warmup ? (
        <p className="text-gray-300 text-lg font-semibold">Bodyweight</p>
      ) : (
        <p className="text-white font-num text-6xl leading-none" data-testid="prep-weight">
          {formatWeight(weight)}
          {weight !== 0 && <span className="ml-1.5 font-sans text-xl font-semibold text-gray-400">lb</span>}
        </p>
      )}
      {(hold.numSets ?? 2) > 1 && (
        <p className="text-gray-400 text-base">Set <span className="font-num text-white">{setNumber}</span> of <span className="font-num">{hold.numSets ?? 2}</span></p>
      )}
    </div>
  );
}
