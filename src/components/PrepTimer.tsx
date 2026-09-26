import { HoldName } from "./HoldName";
import { useEffect } from "react";
import { useWorkoutStore } from "../store/useWorkoutStore";
import { PREP_SECS } from "../data/workout";

import { useTimer } from "../hooks/useTimer";
import { useAudio } from "../hooks/useAudio";
import { TimerRing } from "./TimerRing";
import { formatWeight } from "../lib/format";
import { isWarmup } from "../data/holds";
import { WarmupBadge } from "./WarmupBadge";

export function PrepTimer() {
  const setNumber = useWorkoutStore((s) => s.setNumber);
  const advancePhase = useWorkoutStore((s) => s.advancePhase);
  const effectiveWeight = useWorkoutStore((s) => s.effectiveWeight);
  const paused = useWorkoutStore((s) => s.paused);
  const currentHold = useWorkoutStore((s) => s.currentHold);

  const pauseWorkout = useWorkoutStore((s) => s.pauseWorkout);
  const resumeWorkout = useWorkoutStore((s) => s.resumeWorkout);

  const hold = currentHold();
  const warmup = isWarmup(hold);
  const weight = effectiveWeight(hold.id, setNumber);
  const audio = useAudio();
  const prepDuration = hold.prepSecs ?? PREP_SECS;

  useEffect(() => { audio.prepStart(); }, []);


  const { remaining } = useTimer({
    duration: prepDuration,
    running: !paused,
    onTick: (r) => {
      if (r <= 3.05 && r > 0.05 && Math.ceil(r) !== Math.ceil(r + 0.1)) {
        audio.countdownTick();
      }
    },
    onExpire: advancePhase,
  });

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
