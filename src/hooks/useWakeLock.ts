import { useEffect } from "react";

/** Keep the screen on while `active`. Re-acquired when the page becomes visible again. */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        const sentinel = await navigator.wakeLock.request("screen");
        // The effect may have been cleaned up while the request was in flight;
        // a lock that arrives late must be released, not kept forever.
        if (cancelled) {
          sentinel.release().catch(() => {});
          return;
        }
        lock?.release().catch(() => {});
        lock = sentinel;
      } catch {
        // Wake lock not supported or denied — silently ignore
      }
    };

    void acquire();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      lock?.release().catch(() => {});
      lock = null;
    };
  }, [active]);
}
