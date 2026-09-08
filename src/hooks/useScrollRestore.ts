import { useEffect, useLayoutEffect, useRef } from "react";

// Screens are unmounted when you drill into an overlay (editing a workout, say),
// so their scroll position dies with them. Park it here, keyed per screen, and
// put it back when the screen comes around again.
const positions = new Map<string, number>();

/** Forget a screen's saved offset, so it opens at the top next time. */
export function forgetScrollPosition(key: string) {
  positions.delete(key);
}

/**
 * Remembers the scroll offset of a container across unmounts.
 *
 * Attach the returned ref to the scrolling element. Pass `ready: false` while
 * the screen is still loading its data — the position is only restored once the
 * content that gives the container its height is actually on screen.
 */
export function useScrollRestore<T extends HTMLElement>(key: string, ready = true) {
  const ref = useRef<T>(null);

  // Record as the user scrolls. Saving on unmount instead would be wrong: the
  // container is at the top whenever it is torn down or re-created, so a
  // teardown write would clobber the offset we are trying to keep.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => positions.set(key, el.scrollTop);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [key, ready]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !ready) return;
    const target = positions.get(key) ?? 0;
    if (target === 0) return;

    el.scrollTop = target;
    if (Math.abs(el.scrollTop - target) < 1) return;

    // The container was still shorter than the saved offset — charts and other
    // late-measuring content can add height a frame later. Try again next frame,
    // but give up the moment the user touches the screen.
    let frame = 0;
    let tries = 0;
    const cancel = () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("wheel", cancel);
      el.removeEventListener("touchstart", cancel);
    };
    const retry = () => {
      el.scrollTop = target;
      if (Math.abs(el.scrollTop - target) < 1 || ++tries > 10) return cancel();
      frame = requestAnimationFrame(retry);
    };
    frame = requestAnimationFrame(retry);
    el.addEventListener("wheel", cancel, { passive: true });
    el.addEventListener("touchstart", cancel, { passive: true });
    return cancel;
  }, [key, ready]);

  return ref;
}
