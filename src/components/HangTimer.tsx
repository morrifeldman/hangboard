import { useEffect, useRef } from "react";
import { HANG_SECS, REST_SECS, HOLDS, SET1_REPS, SET2_REPS } from "../data/workout";
import { useTimer } from "../hooks/useTimer";
import { useAudio } from "../hooks/useAudio";
import { useWorkoutStore } from "../store/useWorkoutStore";
import { TimerRing } from "./TimerRing";

export function HangTimer() {
  const phase = useWorkoutStore((s) => s.phase);
  const holdIndex = useWorkoutStore((s) => s.holdIndex);
  const setNumber = useWorkoutStore((s) => s.setNumber);
  const repIndex = useWorkoutStore((s) => s.repIndex);
  const advancePhase = useWorkoutStore((s) => s.advancePhase);
  const skipSet = useWorkoutStore((s) => s.skipSet);
  const paused = useWorkoutStore((s) => s.paused);

  const audio = useAudio();
  const firedStartRef = useRef(false);

  const isHanging = phase === "hanging";
  const isResting = phase === "resting";
  const duration = isHanging ? HANG_SECS : REST_SECS;
  const hold = HOLDS[holdIndex];
  const totalReps = setNumber === 1 ? SET1_REPS : SET2_REPS;

  // Fire hang-start audio/haptic once when hanging phase begins
  useEffect(() => {
    if (isHanging && !firedStartRef.current) {
      firedStartRef.current = true;
      audio.hangStart();
    }
    if (!isHanging) {
      firedStartRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHanging]);

  const { remaining } = useTimer({
    duration,
    running: (isHanging || isResting) && !paused,
    onTick: (r) => {
      if (isHanging && (r <= 3.05 && r > 0.05)) {
        const secs = Math.ceil(r);
        // Fire tick once per second in countdown zone
        if (Math.ceil(r) !== Math.ceil(r + 0.1)) {
          audio.countdownTick();
        }
        void secs;
      }
    },
    onExpire: () => {
      if (isHanging) {
        audio.hangEnd();
        const isLastRep = repIndex >= totalReps - 1;
        if (isLastRep) {
          audio.setComplete();
        }
      }
      advancePhase();
    },
  });

  const color = isHanging ? "stroke-green-400" : "stroke-yellow-400";
  const label = isHanging ? "HANG" : "REST";

  return (
    <div className="flex flex-col items-center gap-6">
      <p className="text-white font-bold text-xl">{hold.name}</p>
      <TimerRing
        remaining={remaining}
        duration={duration}
        label={label}
        color={color}
      />
      <div className="flex gap-2" data-testid="rep-counter">
        {Array.from({ length: totalReps }, (_, i) => {
          const done = isHanging ? i < repIndex : i <= repIndex;
          const active = isHanging && i === repIndex;
          return (
            <div
              key={i}
              className={`w-3 h-3 rounded-full transition-colors ${
                active ? "bg-green-400" : done ? "bg-white/50" : "bg-gray-600"
              }`}
            />
          );
        })}
      </div>
      <button
        onClick={skipSet}
        className="px-4 py-2 rounded-lg bg-gray-700 text-gray-300 text-sm font-semibold"
        data-testid="skip-set-btn"
      >
        Skip set
      </button>
    </div>
  );
}
