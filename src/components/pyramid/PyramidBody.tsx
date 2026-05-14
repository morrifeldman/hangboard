import { useCallback, useEffect, useRef, useState } from "react";
import { getStyleColor } from "../../lib/climbUtils";
import type { ClimbRecord } from "../../lib/climbs";
import type { PyramidRow } from "../../lib/climbUtils";

const IDEAL_TILE = 24;
const IDEAL_GAP = 4;
const MIN_TILE = 6;
const MIN_GAP = 1;
const TILE_COUNT_THRESHOLD = 14;

function fitTiles(avail: number, n: number) {
  if (n <= 0) return { tile: IDEAL_TILE, gap: IDEAL_GAP };
  const idealTotal = n * IDEAL_TILE + Math.max(0, n - 1) * IDEAL_GAP;
  if (idealTotal <= avail) return { tile: IDEAL_TILE, gap: IDEAL_GAP };
  // Scale tile keeping gap ≈ tile/6; if still over, drop gap to MIN_GAP.
  let tile = Math.floor(avail / (n + (n - 1) / 6));
  let gap = Math.max(MIN_GAP, Math.floor(tile / 6));
  if (n * tile + (n - 1) * gap > avail) {
    gap = MIN_GAP;
    tile = Math.floor((avail - (n - 1) * gap) / n);
  }
  return {
    tile: Math.max(MIN_TILE, Math.min(IDEAL_TILE, tile)),
    gap: Math.max(MIN_GAP, gap),
  };
}

function defaultTitle(climb: ClimbRecord): string {
  const base = `${climb.route} - ${climb.style}`;
  if (climb.style === "redpoint" && climb.climbs > 2) {
    return `${base} after ${climb.climbs - 1} attempts`;
  }
  if (climb.style === "attempt") {
    return `${climb.route} — ${climb.climbs} attempt${climb.climbs !== 1 ? "s" : ""}`;
  }
  return base;
}

type Props = {
  rows: PyramidRow[];
  showCounts: boolean;
  onClimbClick: (c: ClimbRecord) => void;
  /** Background utility class for the sticky label gutter; must match parent bg. */
  gutterBgClass?: string;
  /** Override the per-climb tooltip text. */
  getClimbTitle?: (c: ClimbRecord) => string;
};

export function PyramidBody({
  rows,
  showCounts,
  onClimbClick,
  gutterBgClass = "bg-gray-900",
  getClimbTitle = defaultTitle,
}: Props) {
  const maxClimbs = Math.max(...rows.map((r) => r.climbs.length), 1);

  // Cumulative count from the top (hardest): "sends at or above this grade".
  const cumulatives: number[] = [];
  {
    let running = 0;
    for (const r of rows) cumulatives.push((running += r.climbs.length));
  }
  const maxCum = cumulatives[cumulatives.length - 1] || 1;

  const scrollRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);

  // Callback ref so the observer re-attaches if the element remounts
  // (e.g. after an empty-state early-return upstream is replaced with real rows).
  const containerRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    setContainerWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setContainerWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const labelGutter = showCounts ? 144 : 64;
  const availForTiles =
    containerWidth === null ? Infinity : Math.max(0, containerWidth - labelGutter - 4);
  const { tile: tileSize, gap: tileGap } = fitTiles(availForTiles, maxClimbs);
  const rowHeight = Math.max(20, tileSize + 6);
  const tileRadius = Math.max(2, Math.floor(tileSize / 6));
  const showTileCount = tileSize >= TILE_COUNT_THRESHOLD;
  const rowMinWidth = maxClimbs * tileSize + Math.max(0, maxClimbs - 1) * tileGap;

  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current;
      if (el.scrollWidth > el.clientWidth) {
        el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
      }
    }
  }, [rows, maxClimbs, tileSize, tileGap]);

  return (
    <div ref={containerRef} className="relative">
      {/* Fixed grade labels */}
      <div className={`absolute left-0 top-0 z-10 ${gutterBgClass} ${showCounts ? "w-36" : "w-16"}`}>
        <div className="space-y-1">
          {rows.map((r, i) => (
            <div
              key={r.grade}
              className={`grid items-center pl-1 pr-1 gap-1 ${
                showCounts ? "grid-cols-[3rem_1.5rem_28px_auto]" : "grid-cols-[3rem]"
              }`}
              style={{ height: rowHeight }}
            >
              <span className="text-sm font-medium text-gray-400 tabular-nums">{r.grade}</span>
              {showCounts && (
                <>
                  <span className="text-[10px] text-gray-500 tabular-nums">
                    {r.climbs.length > 0 ? `[${r.climbs.length}]` : ""}
                  </span>
                  <div
                    className="h-2 bg-indigo-500/60 rounded-sm justify-self-end"
                    style={{ width: `${(cumulatives[i] / maxCum) * 24}px` }}
                  />
                  <span className="text-[10px] text-indigo-400/80 tabular-nums italic">
                    {cumulatives[i] > 0 ? `(${cumulatives[i]})` : ""}
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Pyramid rows (scrolls only if tiles already at floor size) */}
      <div
        ref={scrollRef}
        className={`overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
          showCounts ? "pl-36" : "pl-16"
        }`}
      >
        <div style={{ minWidth: `${rowMinWidth}px` }}>
          <div className="space-y-1">
            {rows.map((r) => (
              <div
                key={r.grade}
                className="flex items-center"
                style={{ height: rowHeight }}
              >
                <div className="flex-1 flex justify-center">
                  <div className="flex" style={{ gap: tileGap }}>
                    {r.climbs.map((climb, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => onClimbClick(climb)}
                        title={getClimbTitle(climb)}
                        className={`${getStyleColor(climb.style)} flex items-center justify-center text-white text-xs font-bold cursor-pointer hover:scale-110 transition-transform appearance-none p-0 border-0 leading-none`}
                        style={{
                          width: tileSize,
                          height: tileSize,
                          borderRadius: tileRadius,
                        }}
                      >
                        {showTileCount &&
                        climb.climbs > (climb.style === "redpoint" ? 2 : 1)
                          ? climb.climbs
                          : ""}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
