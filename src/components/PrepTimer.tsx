import { useWorkoutStore } from "../store/useWorkoutStore";
import { HOLDS, PREP_SECS } from "../data/workout";
import { useTimer } from "../hooks/useTimer";
import { useAudio } from "../hooks/useAudio";
import { TimerRing } from "./TimerRing";
import { formatWeight } from "../lib/format";

export function PrepTimer() {
  const holdIndex = useWorkoutStore((s) => s.holdIndex);
  const setNumber = useWorkoutStore((s) => s.setNumber);
  const advancePhase = useWorkoutStore((s) => s.advancePhase);
  const effectiveWeight = useWorkoutStore((s) => s.effectiveWeight);
  const paused = useWorkoutStore((s) => s.paused);

  const hold = HOLDS[holdIndex];
  const weight = effectiveWeight(hold.id, setNumber);
  const audio = useAudio();

  const { remaining } = useTimer({
    duration: PREP_SECS,
    running: !paused,
    onTick: (r) => {
      if (r <= 3.05 && r > 0.05 && Math.ceil(r) !== Math.ceil(r + 0.1)) {
        audio.countdownTick();
      }
    },
    onExpire: advancePhase,
  });

  return (
    <div className="flex flex-col items-center gap-6">
      <p className="text-white font-bold text-xl" data-testid="hold-name">{hold.name}</p>
      <TimerRing
        remaining={remaining}
        duration={PREP_SECS}
        label="GET READY"
        color="stroke-orange-400"
      />
      <p className="text-gray-300 text-lg font-semibold tabular-nums">
        {formatWeight(weight)}
      </p>
    </div>
  );
}
