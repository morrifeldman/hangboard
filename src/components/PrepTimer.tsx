import { useEffect } from "react";
import { useWorkoutStore } from "../store/useWorkoutStore";
import { PREP_SECS } from "../data/workout";

import { useTimer } from "../hooks/useTimer";
import { useAudio } from "../hooks/useAudio";
import { TimerRing } from "./TimerRing";
import { formatWeight } from "../lib/format";

export function PrepTimer() {
  const setNumber = useWorkoutStore((s) => s.setNumber);
  const advancePhase = useWorkoutStore((s) => s.advancePhase);
  const effectiveWeight = useWorkoutStore((s) => s.effectiveWeight);
  const paused = useWorkoutStore((s) => s.paused);
  const currentHold = useWorkoutStore((s) => s.currentHold);

  const pauseWorkout = useWorkoutStore((s) => s.pauseWorkout);
  const resumeWorkout = useWorkoutStore((s) => s.resumeWorkout);

  const hold = currentHold();
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
      <p className="text-white font-bold text-xl" data-testid="hold-name">{hold.name}</p>
      <TimerRing
        remaining={remaining}
        duration={prepDuration}
        label="GET READY"
        color="stroke-orange-400"
        onClick={paused ? resumeWorkout : pauseWorkout}
        paused={paused}
      />
      <p className="text-gray-300 text-lg font-semibold tabular-nums">
        {formatWeight(weight)}
      </p>
      {(hold.numSets ?? 2) > 1 && (
        <p className="text-gray-500 text-sm">Set {setNumber} of {hold.numSets ?? 2}</p>
      )}
    </div>
  );
}
