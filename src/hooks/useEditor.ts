import { useEffect, useRef, useState } from "react";
import { useLeaveGuard } from "./useLeaveGuard";
import type { LeaveGuard } from "./useLeaveGuard";

/**
 * Two-tap confirm for destructive buttons: the first tap arms it for `ms`,
 * a second tap within that window runs `onConfirm`.
 */
export function useConfirmTap(onConfirm: () => void, ms = 3000): { armed: boolean; tap: () => void } {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const tap = () => {
    if (timer.current) clearTimeout(timer.current);
    if (armed) {
      setArmed(false);
      onConfirm();
      return;
    }
    setArmed(true);
    timer.current = setTimeout(() => setArmed(false), ms);
  };
  return { armed, tap };
}

export type Editor = {
  guard: LeaveGuard;
  /** True while a save or delete is in flight; buttons should disable. */
  busy: boolean;
  /** What went wrong with the last save or delete, for the footer to show. */
  error: string | null;
  save: () => void;
  /** Two-tap delete. Undefined when the editor has nothing to delete. */
  remove?: { armed: boolean; tap: () => void };
};

/**
 * The save / delete / leave-guard plumbing every editor screen shares.
 *
 * - Leaving with unsaved work asks first (`guard`, render <LeaveGuardSheet>).
 * - A second tap while a save is in flight is ignored, so a slow write can't
 *   create two records.
 * - The screen only closes once the write has succeeded. A failure stays on
 *   the screen with an error, rather than navigating away as if it worked.
 */
export function useEditor(opts: {
  dirty: boolean;
  onSave: () => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
  /** Called after a successful save or delete. */
  onDone: () => void;
}): Editor {
  const guard = useLeaveGuard(opts.dirty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const run = async (action: () => Promise<void> | void, failure: string) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      console.error(err);
      setError(failure);
      setBusy(false);
      inFlight.current = false;
      return;
    }
    guard.allowLeave();
    opts.onDone();
  };

  const onDelete = opts.onDelete;
  const confirmDelete = useConfirmTap(() => {
    if (onDelete) void run(onDelete, "Couldn't delete. Try again.");
  });

  return {
    guard,
    busy,
    error,
    save: () => void run(opts.onSave, "Couldn't save. Try again."),
    remove: onDelete ? confirmDelete : undefined,
  };
}
