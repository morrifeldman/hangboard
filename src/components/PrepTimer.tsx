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

  const hold = currentHold();
  const weight = effectiveWeight(hold.id, setNumber);
  const audio = useAudio();
  const prepDuration = hold.prepSecs ?? PREP_SECS;

  // Pull-up items skip the hang phase entirely — jump straight to the rest timer
  useEffect(() => {
    if (hold.isRestOnly) advancePhase();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hold.id]);

  const { remaining } = useTimer({
    duration: prepDuration,
    running: !paused && !hold.isRestOnly,
    onTick: (r) => {
      if (r <= 3.05 && r > 0.05 && Math.ceil(r) !== Math.ceil(r + 0.1)) {
        audio.countdownTick();
      }
    },
    onExpire: advancePhase,
  });

  if (hold.isRestOnly) return null;

  return (
    <div className="flex flex-col items-center gap-6">
      <p className="text-white font-bold text-xl" data-testid="hold-name">{hold.name}</p>
      <TimerRing
        remaining={remaining}
        duration={prepDuration}
        label="GET READY"
        color="stroke-orange-400"
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
