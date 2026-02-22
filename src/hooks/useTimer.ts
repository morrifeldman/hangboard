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
  const pausedAtRef = useRef<number | null>(null);

  useEffect(() => { onExpireRef.current = onExpire; }, [onExpire]);
  useEffect(() => { onTickRef.current = onTick; }, [onTick]);

  // New phase started — clear any saved pause position and reset display
  useEffect(() => {
    pausedAtRef.current = null;
    setRemaining(duration);
  }, [duration]);

  useEffect(() => {
    if (!running) return;

    // Resume from paused position if available, otherwise start fresh
    const startRemaining = pausedAtRef.current ?? duration;
    pausedAtRef.current = null;
    setRemaining(startRemaining);
    const end = Date.now() + startRemaining * 1000;

    const interval = setInterval(() => {
      const r = Math.max(0, (end - Date.now()) / 1000);
      setRemaining(r);
      onTickRef.current?.(r);
      if (r <= 0) {
        clearInterval(interval);
        onExpireRef.current();
      }
    }, 100);

    return () => {
      // Save remaining so resume can pick up where we left off
      pausedAtRef.current = Math.max(0, (end - Date.now()) / 1000);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, duration]);

  return { remaining };
}
