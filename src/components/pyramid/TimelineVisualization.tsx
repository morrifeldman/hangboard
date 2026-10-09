import { useEffect, useRef } from "react";
import { SPORT_GRADES, BOULDER_GRADES } from "../../constants/climbGrades";
import { deduplicateForTimeline } from "../../lib/deduplication";
import { climbsInView, getFilteredClimbs, getStyleColor } from "../../lib/climbUtils";
import { climbPRs } from "../../lib/climbPRs";
import { prGlow } from "./stone";
import { formatDateKey } from "../../lib/dates";
import type { ClimbRecord } from "../../lib/climbs";
import type { ViewKey } from "../../constants/climbGrades";

type Props = {
  climbs: ClimbRecord[];
  currentView: ViewKey;
  showSendsOnly: boolean;
  timeRange: [number, number];
  onClimbClick: (c: ClimbRecord) => void;
};

export function TimelineVisualization({ climbs, currentView, showSendsOnly, timeRange, onClimbClick }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Filter by view and time range, then deduplicate
  const deduped = deduplicateForTimeline(getFilteredClimbs(climbs, currentView, timeRange));
  const filtered = showSendsOnly ? deduped.filter((c) => c.style !== "attempt") : deduped;
  // PRs come from the whole history in view, so zooming the range can't make one.
  const prs = climbPRs(deduplicateForTimeline(climbsInView(climbs, currentView)));

  // Group by date
  const climbsByDate: Record<string, ClimbRecord[]> = {};
  for (const c of filtered) {
    (climbsByDate[c.date] ??= []).push(c);
  }
  const sortedDates = Object.keys(climbsByDate).sort();
  const datesKey = sortedDates.join();

  // Keep the newest dates in view whenever the set of dates changes.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [datesKey]);

  if (filtered.length === 0) return null;

  // Grade range
  const isBoulder = currentView.includes("boulder");
  const fullGrades: readonly string[] = isBoulder ? BOULDER_GRADES : SPORT_GRADES;
  const climbGradeIdxs = [...new Set(filtered.map((c) => c.grade))]
    .map((g) => fullGrades.indexOf(g))
    .filter((i) => i !== -1);
  const minIdx = Math.max(0, Math.min(...climbGradeIdxs) - 1);
  const maxIdx = Math.min(fullGrades.length - 1, Math.max(...climbGradeIdxs) + 1);
  const relevantGrades = fullGrades.slice(minIdx, maxIdx + 1);
  const reversed = [...relevantGrades].reverse();

  const timelineHeight = 200;
  const gradeHeight = timelineHeight / relevantGrades.length;

  return (
    <div className="mb-6">
      <div className="relative">
        {/* Grade labels */}
        <div className="absolute left-0 top-0 z-10 w-16 bg-gray-900">
          <div className="h-8 mb-2" />
          <div className="relative" style={{ height: `${timelineHeight}px` }}>
            {reversed.map((grade, gi) => (
              <div
                key={grade}
                className="absolute flex items-center justify-end pr-2 font-num text-[13px] text-gray-500 bg-gray-900"
                style={{ top: `${(gi + 1) * gradeHeight - 10}px`, height: "20px", right: 0, width: "100%" }}
              >
                {isBoulder || grade.endsWith("a") || grade.endsWith("c") ? grade : ""}
              </div>
            ))}
          </div>
          <div className="h-6 mt-2" />
        </div>

        {/* Scrollable timeline */}
        {/* Padding keeps PR glows at the first and last columns from being clipped. */}
        <div ref={scrollRef} className="overflow-x-auto ml-16 px-3">
          <div className="flex space-x-2" style={{ minWidth: `${sortedDates.length * 60}px` }}>
            {sortedDates.map((date) => (
              <div key={date} className="flex-shrink-0 w-14">
                <div className="h-8 mb-2 flex items-end justify-center">
                  <div className="text-xs text-gray-500 text-center transform -rotate-45 origin-bottom">
                    {formatDateKey(date, { year: false })}
                  </div>
                </div>

                <div className="relative" style={{ height: `${timelineHeight}px` }}>
                  {reversed.map((grade, gi) => (
                    <div
                      key={grade}
                      className="absolute w-full border-b border-gray-700"
                      style={{ top: `${gi * gradeHeight}px`, height: `${gradeHeight}px` }}
                    />
                  ))}

                  {climbsByDate[date].map((climb, ci) => {
                    const gi = reversed.indexOf(climb.grade);
                    if (gi === -1) return null;
                    const isPR = prs.has(climb.id);
                    return (
                      <div
                        key={`${climb.id}-${ci}`}
                        className={`absolute ${isPR ? "z-20" : "z-10"} w-6 h-6 rounded ${getStyleColor(climb.style)} border border-gray-900 shadow-sm cursor-pointer hover:scale-110 transition-transform`}
                        style={{
                          top: `${(gi + 1) * gradeHeight - 12}px`,
                          left: `${ci * 8}px`,
                          boxShadow: isPR ? prGlow(climb.style) : undefined,
                        }}
                        title={`${climb.route} - ${climb.grade} (${climb.style}${isPR ? ", personal record" : ""})`}
                        onClick={() => onClimbClick(climb)}
                      >
                        {(() => {
                          const failures = climb.style === "attempt" ? climb.climbs : climb.climbs - 1;
                          return failures > 1 ? (
                            <span className="absolute inset-0 flex items-center justify-center text-xs text-white font-semibold">
                              {failures}
                            </span>
                          ) : null;
                        })()}
                                              </div>
                    );
                  })}
                </div>
                <div className="h-6 mt-2" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
