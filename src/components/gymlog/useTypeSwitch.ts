import { useEffect, useRef, useState } from "react";
import type { GymWorkoutType } from "../../lib/history";

/**
 * The staged "Switch to X? Current entries will be cleared." confirm. It
 * resets itself after a while, so it can never get stuck; timing out simply
 * keeps the current type (the safe default).
 */
export function useTypeSwitch(ms = 6000) {
  const [pendingType, setPendingType] = useState<GymWorkoutType | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };
  useEffect(() => clearTimer, []);

  return {
    pendingType,
    /** Ask for confirmation before switching to `t`. */
    stage: (t: GymWorkoutType) => {
      setPendingType(t);
      clearTimer();
      timer.current = setTimeout(() => setPendingType(null), ms);
    },
    /** Drop the prompt; returns the staged type, if any. */
    resolve: (): GymWorkoutType | null => {
      clearTimer();
      setPendingType(null);
      return pendingType;
    },
  };
}
