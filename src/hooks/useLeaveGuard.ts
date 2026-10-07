import { useRef } from "react";
import { useBlocker } from "@tanstack/react-router";

export type LeaveGuard = {
  /** True while a navigation is held, waiting for the person to choose. */
  asking: boolean;
  stay: () => void;
  leave: () => void;
  /** Call just before saving or deleting navigates away, which must never ask. */
  allowLeave: () => void;
};

/**
 * Holds any navigation away from a screen with unsaved work: tab taps, the
 * back chevron, hardware back, and closing or reloading the page. Pair it
 * with <LeaveGuardSheet>, which asks whether to stay or discard.
 */
export function useLeaveGuard(dirty: boolean): LeaveGuard {
  const leavingRef = useRef(false);
  const shouldBlock = () => dirty && !leavingRef.current;
  const blocker = useBlocker({
    shouldBlockFn: shouldBlock,
    enableBeforeUnload: shouldBlock,
    withResolver: true,
  });
  const asking = blocker.status === "blocked";
  return {
    asking,
    stay: () => blocker.reset?.(),
    leave: () => blocker.proceed?.(),
    allowLeave: () => {
      leavingRef.current = true;
    },
  };
}
