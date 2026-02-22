import { useEffect, useRef, useState } from "react";

interface UseTimerOptions {
  duration: number; // seconds
  onExpire: () => void;
  onTick?: (remaining: number) => void;
  running?: boolean;
}

export function useTimer({ duration, onExpire, onTick, running = true }: UseTimerOptions) {
  const [remaining, setRemaining] = useState(duration);
  const onExpireRef = useRef(onExpire);
  const onTickRef = useRef(onTick);

  useEffect(() => { onExpireRef.current = onExpire; }, [onExpire]);
  useEffect(() => { onTickRef.current = onTick; }, [onTick]);

  // Reset when duration changes (new phase started)
  useEffect(() => {
    setRemaining(duration);
  }, [duration]);

  useEffect(() => {
    if (!running) return;

    setRemaining(duration);
    const end = Date.now() + duration * 1000;

    const interval = setInterval(() => {
      const r = Math.max(0, (end - Date.now()) / 1000);
      setRemaining(r);
      onTickRef.current?.(r);
      if (r <= 0) {
        clearInterval(interval);
        onExpireRef.current();
      }
    }, 100);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, duration]);

  return { remaining };
}
