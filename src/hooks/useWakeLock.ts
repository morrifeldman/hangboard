import { useEffect, useRef } from "react";

export function useWakeLock(active: boolean) {
  const lockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active) {
      lockRef.current?.release();
      lockRef.current = null;
      return;
    }

    const acquire = async () => {
      try {
        lockRef.current = await navigator.wakeLock.request("screen");
      } catch {
        // Wake lock not supported or denied — silently ignore
      }
    };

    acquire();

    const handleVisibility = () => {
      if (document.visibilityState === "visible" && active) {
        acquire();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      lockRef.current?.release();
      lockRef.current = null;
    };
  }, [active]);
}
