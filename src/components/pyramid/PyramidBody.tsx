import { useCallback, useEffect, useRef, useState } from "react";
import { getStyleColor } from "../../lib/climbUtils";
import type { ClimbRecord } from "../../lib/climbs";
import type { PyramidRow } from "../../lib/climbUtils";

const IDEAL_TILE = 24;
const IDEAL_GAP = 4;
const MIN_TILE = 6;
const MIN_GAP = 1;
const TILE_COUNT_THRESHOLD = 14;
const IDEAL_ROW_HEIGHT = Math.max(20, IDEAL_TILE + 6);
const IDEAL_TILE_RADIUS = Math.max(2, Math.floor(IDEAL_TILE / 6));

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

function defaultTitle(climb: ClimbRecord & { sessions?: number }): string {
  const sessionsText =
    climb.sessions && climb.sessions > 1 ? ` · ${climb.sessions} sessions` : "";
  const base = `${climb.route} - ${climb.style}${sessionsText}`;
  if (climb.style === "redpoint" && climb.climbs > 2) {
    return `${base} after ${climb.climbs - 1} attempts`;
  }
  if (climb.style === "attempt") {
    return `${climb.route} — ${climb.climbs} attempt${climb.climbs !== 1 ? "s" : ""}${sessionsText}`;
  }
  return base;
}

type Props = {
  rows: PyramidRow[];
  showCounts: boolean;
  /** When true, the per-tile number shows session count (distinct entries) instead of climb count. */
  showSessionCounts?: boolean;
  onClimbClick: (c: ClimbRecord) => void;
  /** Background utility class for the sticky label gutter; must match parent bg. */
  gutterBgClass?: string;
  /** Override the per-climb tooltip text. */
  getClimbTitle?: (c: ClimbRecord & { sessions?: number }) => string;
};

export function PyramidBody({
  rows,
  showCounts,
  showSessionCounts = false,
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
  // Tapping a grade label expands that row to full-size tiles on one line
  // (overflowing horizontally if needed). Tap again — or another grade — to
  // collapse/switch.
  const [expandedGrade, setExpandedGrade] = useState<string | null>(null);

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

  const toggleExpand = (grade: string) =>
    setExpandedGrade((g) => (g === grade ? null : grade));

  return (
    <div ref={containerRef} className="relative">
      {/* Fixed grade labels (clickable to bloom that row to full size) */}
      <div className={`absolute left-0 top-0 z-10 ${gutterBgClass} ${showCounts ? "w-36" : "w-16"}`}>
        <div className="space-y-1">
          {rows.map((r, i) => {
            const isExpanded = expandedGrade === r.grade;
            const hasClimbs = r.climbs.length > 0;
            const rh = isExpanded ? IDEAL_ROW_HEIGHT : rowHeight;
            return (
              <button
                key={r.grade}
                type="button"
                onClick={hasClimbs ? () => toggleExpand(r.grade) : undefined}
                disabled={!hasClimbs}
                title={
                  hasClimbs
                    ? isExpanded
                      ? `Collapse ${r.grade}`
                      : `Expand ${r.grade} to full size`
                    : undefined
                }
                className={`grid w-full items-center pl-1 pr-1 gap-1 appearance-none border-0 bg-transparent text-left transition-colors ${
                  showCounts ? "grid-cols-[3rem_1.5rem_28px_auto]" : "grid-cols-[3rem]"
                } ${hasClimbs ? "cursor-pointer hover:bg-white/5" : "cursor-default"}`}
                style={{ height: rh }}
              >
                <span
                  className={`text-sm font-medium tabular-nums ${
                    isExpanded ? "text-white" : "text-gray-400"
                  }`}
                >
                  {r.grade}
                </span>
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
              </button>
            );
          })}
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
            {rows.map((r) => {
              const isExpanded = expandedGrade === r.grade;
              const t = isExpanded ? IDEAL_TILE : tileSize;
              const g = isExpanded ? IDEAL_GAP : tileGap;
              const rh = isExpanded ? IDEAL_ROW_HEIGHT : rowHeight;
              const radius = isExpanded ? IDEAL_TILE_RADIUS : tileRadius;
              const withCount = isExpanded ? true : showTileCount;
              const rowIdealWidth =
                r.climbs.length * t + Math.max(0, r.climbs.length - 1) * g;

              const tiles = r.climbs.map((climb, idx) => {
                const sessions = climb.sessions ?? 1;
                const value = showSessionCounts ? sessions : climb.climbs;
                const threshold = showSessionCounts
                  ? 1
                  : climb.style === "redpoint"
                    ? 2
                    : 1;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onClimbClick(climb)}
                    title={getClimbTitle(climb)}
                    className={`${getStyleColor(climb.style)} flex shrink-0 items-center justify-center text-white text-xs font-bold cursor-pointer hover:scale-110 transition-transform appearance-none p-0 border-0 leading-none`}
                    style={{
                      width: t,
                      height: t,
                      borderRadius: radius,
                    }}
                  >
                    {withCount && value > threshold ? value : ""}
                  </button>
                );
              });

              return (
                <div
                  key={r.grade}
                  className="flex items-center"
                  style={{ height: rh }}
                >
                  {isExpanded ? (
                    <div className="flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      <div
                        className="flex"
                        style={{
                          gap: g,
                          justifyContent: "safe center",
                          minWidth: `${rowIdealWidth}px`,
                        }}
                      >
                        {tiles}
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex justify-center">
                      <div className="flex" style={{ gap: g }}>
                        {tiles}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
