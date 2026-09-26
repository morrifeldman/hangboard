import { useCallback, useState } from "react";
import { buildPyramid, getFilteredClimbs, getStyleColor } from "../../lib/climbUtils";
import { deduplicateForPyramid } from "../../lib/deduplication";
import type { ClimbRecord } from "../../lib/climbs";
import { STONE_EDGE, STYLE_LEGEND, stoneRadius } from "./stone";

// Compact, read-only outdoor-sport pyramid rendered on the home screen. Mirrors
// the default view of the full PyramidScreen (outdoor sport, sends only, full
// time range) but strips all interactivity — tapping anywhere opens the full
// pyramid page with the real controls.
const MAX_TILE = 14;
const LABEL_GUTTER = 48 + 10;

/** Shrinks stones so the widest row fits on one line; a wrapped row stops looking like a pyramid. */
function fitStones(avail: number, n: number) {
  for (const gap of [3, 2, 1]) {
    const tile = Math.floor((avail - (n - 1) * gap) / n);
    if (tile >= gap * 3 || gap === 1) return { tile: Math.max(3, Math.min(MAX_TILE, tile)), gap };
  }
  return { tile: MAX_TILE, gap: 3 };
}

type Props = {
  climbs: ClimbRecord[];
  onOpen: () => void;
};

export function PyramidPreview({ climbs, onOpen }: Props) {
  const [width, setWidth] = useState<number | null>(null);
  const measureRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const filtered = getFilteredClimbs(climbs, "outdoor-sport", false, [0, 100]);
  const deduped = deduplicateForPyramid(filtered);
  const sends = deduped.filter((c) => c.style !== "attempt");
  // Only non-empty grade rows keep the preview short; the widening toward the
  // base still reads as a pyramid.
  const rows = buildPyramid(sends, "outdoor-sport").filter((r) => r.climbs.length > 0);
  const widest = Math.max(1, ...rows.map((r) => r.climbs.length));
  const { tile, gap } =
    width === null ? { tile: MAX_TILE, gap: 3 } : fitStones(width - LABEL_GUTTER, widest);
  const radius = stoneRadius(tile);

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-white text-lg font-semibold leading-tight">Route pyramid</h2>
        <p className="text-gray-500 text-xs mt-0.5">
          Outdoor sport
          {sends.length > 0 && ` · ${sends.length} route${sends.length === 1 ? "" : "s"} sent`}
        </p>
      </div>
      <button
        type="button"
        onClick={onOpen}
        data-testid="open-pyramid"
        className="w-full bg-gray-800 rounded-2xl px-4 pt-4 pb-3 text-left transition-colors hover:bg-gray-800/80 active:bg-gray-700/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
      >
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <p className="text-gray-400 text-sm">No outdoor sport sends yet</p>
            <span className="text-accent-400 text-sm font-semibold">Open pyramid</span>
          </div>
        ) : (
          <>
            <div ref={measureRef} className="flex flex-col" style={{ gap }}>
              {rows.map((r) => (
                <div key={r.grade} className="flex items-center gap-2.5" style={{ minHeight: tile }}>
                  <span className="w-12 shrink-0 text-right font-num text-[13px] leading-none text-gray-400">
                    {r.grade}
                  </span>
                  <div className="flex flex-1 flex-wrap justify-center" style={{ gap }}>
                    {r.climbs.map((c, i) => (
                      <div
                        key={i}
                        className={getStyleColor(c.style)}
                        style={{ width: tile, height: tile, borderRadius: radius, boxShadow: STONE_EDGE }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-700/60 pt-3">
              <div className="flex gap-3">
                {STYLE_LEGEND.map((s) => (
                  <span key={s.style} className="flex items-center gap-1.5 text-xs text-gray-400">
                    <span className={`h-2.5 w-2.5 rounded-sm ${s.color}`} style={{ boxShadow: STONE_EDGE }} />
                    {s.label}
                  </span>
                ))}
              </div>
              <span className="shrink-0 text-sm font-semibold text-accent-400">Open full pyramid</span>
            </div>
          </>
        )}
      </button>
    </section>
  );
}
