import { useEffect, useRef } from "react";
import { SPORT_GRADES, BOULDER_GRADES } from "../../constants/climbGrades";
import { deduplicateForTimeline } from "../../lib/deduplication";
import { getStyleColor } from "../../lib/climbUtils";
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
  const parts = currentView.split("-");
  const setting = parts[0];
  const type = parts.slice(1).join("-");

  // Filter by view, apply time range, then deduplicate
  let viewFiltered = climbs.filter((c) => c.setting === setting && c.type === type);

  if (viewFiltered.length === 0) return null;

  const dates = viewFiltered.map((c) => new Date(c.date).getTime()).sort((a, b) => a - b);
  const minDate = dates[0];
  const maxDate = dates[dates.length - 1];
  const totalRange = maxDate - minDate;

  if (totalRange > 0) {
    const startDate = minDate + (totalRange * timeRange[0]) / 100;
    const endDate = minDate + (totalRange * timeRange[1]) / 100;
    viewFiltered = viewFiltered.filter((c) => {
      const t = new Date(c.date).getTime();
      return t >= startDate && t <= endDate;
    });
  }

  const deduped = deduplicateForTimeline(viewFiltered);
  const filtered = showSendsOnly ? deduped.filter((c) => c.style !== "attempt") : deduped;

  if (filtered.length === 0) return null;

  // Group by date
  const climbsByDate: Record<string, ClimbRecord[]> = {};
  for (const c of filtered) {
    (climbsByDate[c.date] ??= []).push(c);
  }
  const sortedDates = Object.keys(climbsByDate).sort();

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

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [sortedDates]);

  return (
    <div className="mb-6">
      <h2 className="text-xl font-bold text-center mb-4 text-white">Timeline</h2>

      <div className="relative">
        {/* Grade labels */}
        <div className="absolute left-0 top-0 z-10 w-16 bg-gray-900">
          <div className="h-8 mb-2" />
          <div className="relative" style={{ height: `${timelineHeight}px` }}>
            {reversed.map((grade, gi) => (
              <div
                key={grade}
                className="absolute flex items-center justify-end pr-2 text-xs text-gray-500 font-medium bg-gray-900"
                style={{ top: `${(gi + 1) * gradeHeight - 10}px`, height: "20px", right: 0, width: "100%" }}
              >
                {isBoulder || grade.endsWith("a") || grade.endsWith("c") ? grade : ""}
              </div>
            ))}
          </div>
          <div className="h-6 mt-2" />
        </div>

        {/* Scrollable timeline */}
        <div ref={scrollRef} className="overflow-x-auto ml-16">
          <div className="flex space-x-2" style={{ minWidth: `${sortedDates.length * 60}px` }}>
            {sortedDates.map((date) => (
              <div key={date} className="flex-shrink-0 w-14">
                <div className="h-8 mb-2 flex items-end justify-center">
                  <div className="text-xs text-gray-500 text-center transform -rotate-45 origin-bottom">
                    {new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
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
                    return (
                      <div
                        key={`${climb.id}-${ci}`}
                        className={`absolute w-6 h-6 rounded ${getStyleColor(climb.style)} border border-gray-900 shadow-sm cursor-pointer hover:scale-110 transition-transform`}
                        style={{ top: `${gi * gradeHeight + 2}px`, left: `${ci * 8}px` }}
                        title={`${climb.route} - ${climb.grade} (${climb.style})`}
                        onClick={() => onClimbClick(climb)}
                      >
                        {climb.attempts > 1 && (
                          <span className="absolute inset-0 flex items-center justify-center text-xs text-white font-semibold">
                            {climb.attempts}
                          </span>
                        )}
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
