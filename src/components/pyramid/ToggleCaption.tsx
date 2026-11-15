import type { ToggleCaptionState } from "../../hooks/useToggleCaption";

/**
 * The caption from `useToggleCaption`, floating just under a header's toggles.
 * The header must be `relative`. It overlays what's below instead of pushing it
 * down, so the pyramid doesn't jump on every tap.
 */
export function ToggleCaption({ caption }: { caption: ToggleCaptionState }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute right-4 top-full z-20 -mt-1.5 flex justify-end"
    >
      {caption && (
        <span
          key={caption.n}
          className="rounded-full bg-gray-700 px-3 py-1.5 text-xs font-medium text-gray-100 shadow-lg shadow-black/40 ring-1 ring-inset ring-white/10 motion-safe:animate-caption"
          data-testid="toggle-caption"
        >
          {caption.text}
        </span>
      )}
    </div>
  );
}
