import type { LeaveGuard } from "../hooks/useLeaveGuard";

/** `lost` finishes the sentence "… will be lost.", e.g. "The note you've written". */
export function LeaveGuardSheet({ guard, lost }: { guard: LeaveGuard; lost: string }) {
  if (!guard.asking) return null;
  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[60]" onClick={guard.stay} />
      <div
        role="alertdialog"
        aria-label="Unsaved changes"
        className="fixed bottom-0 left-0 right-0 z-[60] bg-gray-900 rounded-t-2xl px-4 pt-5 pb-6 flex flex-col gap-3"
      >
        <p className="text-white font-semibold">Leave without saving?</p>
        <p className="text-gray-400 text-sm -mt-1">{lost} will be lost.</p>
        <button
          type="button"
          onClick={guard.stay}
          className="w-full h-12 rounded-xl font-semibold bg-accent-500 text-gray-900 text-base"
        >
          Keep editing
        </button>
        <button
          type="button"
          onClick={guard.leave}
          className="w-full h-11 rounded-xl font-semibold bg-gray-800 text-red-400 text-base"
        >
          Discard and leave
        </button>
      </div>
    </>
  );
}
