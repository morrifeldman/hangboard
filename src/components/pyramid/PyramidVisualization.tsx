import { useEffect, useRef } from "react";
import { Mountain } from "lucide-react";
import { getStyleColor, buildPyramid, getFilteredClimbs } from "../../lib/climbUtils";
import { deduplicateForPyramid } from "../../lib/deduplication";
import type { ClimbRecord } from "../../lib/climbs";
import type { ViewKey } from "../../constants/climbGrades";

type Props = {
  climbs: ClimbRecord[];
  currentView: ViewKey;
  showSendsOnly: boolean;
  timeRange: [number, number];
  onClimbClick: (c: ClimbRecord) => void;
  onAddClimbClick: () => void;
};

export function PyramidVisualization({
  climbs,
  currentView,
  showSendsOnly,
  timeRange,
  onClimbClick,
  onAddClimbClick,
}: Props) {
  const viewAndTimeFiltered = getFilteredClimbs(climbs, currentView, false, timeRange);
  const deduplicatedClimbs = deduplicateForPyramid(viewAndTimeFiltered);
  const finalClimbs = showSendsOnly
    ? deduplicatedClimbs.filter((c) => c.style !== "attempt")
    : deduplicatedClimbs;
  const pyramidData = buildPyramid(finalClimbs, currentView);
  const maxClimbs = Math.max(...pyramidData.map((level) => level.climbs.length), 1);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current;
      if (el.scrollWidth > el.clientWidth) {
        el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
      }
    }
  }, [pyramidData, maxClimbs]);

  if (pyramidData.length === 0) {
    return (
      <div className="text-center py-12">
        <Mountain className="mx-auto h-12 w-12 text-gray-600 mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">No climbs yet</h3>
        <p className="text-gray-400 mb-4">Start building your pyramid!</p>
        <button
          onClick={onAddClimbClick}
          className="bg-green-600 text-white px-4 py-2 rounded-xl hover:bg-green-700 transition-colors"
        >
          Add Your First Climb
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2 mb-8">
      <h2 className="text-xl font-bold text-center mb-4 text-white">Pyramid</h2>

      <div className="relative">
        {/* Fixed grade labels */}
        <div className="absolute left-0 top-0 z-10 w-16 bg-gray-900">
          <div className="space-y-1">
            {pyramidData.map((level) => (
              <div key={level.grade} className="h-8 flex items-center">
                <div className="w-16 text-sm font-medium text-right pr-4 text-gray-400">{level.grade}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Scrollable pyramid */}
        <div ref={scrollRef} className="overflow-x-auto pl-16">
          <div style={{ minWidth: `${maxClimbs * 32 + 40}px` }}>
            <div className="space-y-1">
              {pyramidData.map((level) => (
                <div key={level.grade} className="flex items-center h-8">
                  <div className="flex-1 flex justify-center">
                    <div className="flex gap-1">
                      {level.climbs.map((climb, idx) => (
                        <div
                          key={idx}
                          className={`w-6 h-6 rounded ${getStyleColor(climb.style)} flex items-center justify-center text-white text-xs font-bold cursor-pointer hover:scale-110 transition-transform`}
                          title={(() => {
                            const base = `${climb.route} - ${climb.style}`;
                            if (climb.style === "redpoint" && climb.climbs > 2) {
                              const n = climb.climbs - 1;
                              return `${base} after ${n} attempts`;
                            }
                            if (climb.style === "attempt") {
                              const n = climb.climbs;
                              return `${climb.route} — ${n} attempt${n !== 1 ? "s" : ""}`;
                            }
                            return base;
                          })()}
                          onClick={() => onClimbClick(climb)}
                        >
                          {climb.climbs > (climb.style === "redpoint" ? 2 : 1) ? climb.climbs : ""}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
