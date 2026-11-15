import { useCallback, useEffect, useRef, useState } from "react";

/** How long a caption stays up. Matches the `caption` animation in tailwind.config.js. */
const CAPTION_MS = 2200;

export type ToggleCaptionState = { text: string; n: number } | null;

/**
 * A short-lived caption saying what a toggle was just switched to. Icon-only
 * toggles have no label, and `title` tooltips never show on a phone. One at a
 * time: showing another replaces the text and restarts the clock.
 */
export function useToggleCaption() {
  const [caption, setCaption] = useState<ToggleCaptionState>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const show = useCallback((text: string) => {
    if (timer.current) clearTimeout(timer.current);
    // `n` changes every time, so the same text shown twice replays the fade.
    setCaption((prev) => ({ text, n: (prev?.n ?? 0) + 1 }));
    timer.current = setTimeout(() => setCaption(null), CAPTION_MS);
  }, []);

  return { caption, show };
}
