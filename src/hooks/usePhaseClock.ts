import { useEffect, useRef, useState } from "react";
import { useWorkoutStore } from "../store/useWorkoutStore";
import { repsFor } from "../data/holds";
import { Audio } from "../lib/audio";
import { Haptics } from "../lib/haptics";

/**
 * The phase clock as seen by a display: seconds left in the current phase, and
 * the `now` that was measured against. Re-renders every `intervalMs` while the
 * clock runs. Reads the store's clock, so every display agrees with expiry.
 */
export function usePhaseClock(intervalMs = 100): { remaining: number; now: number } {
  const endsAt = useWorkoutStore((s) => s.phaseEndsAt);
  const pausedRemaining = useWorkoutStore((s) => s.pausedRemaining);
  const duration = useWorkoutStore((s) => s.phaseDuration);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    // Paused, the count is frozen but `now` (for the finish time) keeps moving.
    const id = setInterval(tick, endsAt === null ? 1000 : intervalMs);
    return () => clearInterval(id);
  }, [endsAt, intervalMs]);

  if (endsAt === null) return { remaining: pausedRemaining ?? 0, now };
  // `now` can lag a render behind a fresh phase; never show more than the phase holds.
  return { remaining: Math.min(duration, Math.max(0, (endsAt - now) / 1000)), now };
}

export function usePhaseRemaining(intervalMs = 100): number {
  return usePhaseClock(intervalMs).remaining;
}

/**
 * Drives the workout: plays the phase cues and advances the phase when its
 * clock runs out. Mount exactly once, while a workout is on screen.
 *
 * Expiry is keyed to `phaseSeq`, so a late tick can't advance a phase that a
 * tap already moved past. If the phone slept through the end of a phase, the
 * phase ends on wake and the next one starts fresh — hangs never run unseen.
 */
export function useWorkoutDriver(): void {
  const phase = useWorkoutStore((s) => s.phase);
  const phaseSeq = useWorkoutStore((s) => s.phaseSeq);
  const endsAt = useWorkoutStore((s) => s.phaseEndsAt);
  const paused = useWorkoutStore((s) => s.paused);
  const startedSeqRef = useRef<number | null>(null);

  // Start-of-phase cues, once per phase (not again on resume).
  useEffect(() => {
    if (paused || startedSeqRef.current === phaseSeq) return;
    startedSeqRef.current = phaseSeq;
    if (phase === "prep") Audio.prepStart();
    if (phase === "hanging") {
      Audio.hangStart();
      Haptics.hangStart();
    }
  }, [phase, phaseSeq, paused]);

  useEffect(() => {
    if (endsAt === null) return;
    const counts = phase === "prep" || phase === "hanging";
    // Beep as the whole-second count drops to 3, 2, 1. Starting from the current
    // count means a resume mid-countdown doesn't repeat the beep it already played,
    // and a late tick that skips a boundary still beeps once.
    let lastCount = Math.ceil((endsAt - Date.now()) / 1000);

    const tick = () => {
      const left = (endsAt - Date.now()) / 1000;
      const count = Math.ceil(left);
      if (counts && count < lastCount && count >= 1 && count <= 3) {
        Audio.countdownTick();
        Haptics.tick();
      }
      lastCount = Math.min(lastCount, count);
      if (left > 0) return;
      clearInterval(id);
      const s = useWorkoutStore.getState();
      if (s.phase === "hanging") {
        Audio.hangEnd();
        Haptics.hangEnd();
        if (s.repIndex >= repsFor(s.currentHold(), s.setNumber) - 1) {
          Audio.setComplete();
          Haptics.setComplete();
        }
      }
      s.expirePhase(phaseSeq);
    };
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [endsAt, phase, phaseSeq]);
}
