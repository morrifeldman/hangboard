import { Mountain } from "lucide-react";
import { buildPyramid, getFilteredClimbs } from "../../lib/climbUtils";
import { deduplicateForPyramid } from "../../lib/deduplication";
import type { ClimbRecord } from "../../lib/climbs";
import type { ViewKey } from "../../constants/climbGrades";
import { PyramidBody } from "./PyramidBody";

type Props = {
  climbs: ClimbRecord[];
  currentView: ViewKey;
  showSendsOnly: boolean;
  showCounts: boolean;
  showSessionCounts: boolean;
  timeRange: [number, number];
  onClimbClick: (c: ClimbRecord) => void;
  onAddClimbClick: () => void;
};

export function PyramidVisualization({
  climbs,
  currentView,
  showSendsOnly,
  showCounts,
  showSessionCounts,
  timeRange,
  onClimbClick,
  onAddClimbClick,
}: Props) {
  const viewAndTimeFiltered = getFilteredClimbs(climbs, currentView, timeRange);
  const deduplicatedClimbs = deduplicateForPyramid(viewAndTimeFiltered);
  const finalClimbs = showSendsOnly
    ? deduplicatedClimbs.filter((c) => c.style !== "attempt")
    : deduplicatedClimbs;
  const pyramidData = buildPyramid(finalClimbs, currentView);

  if (pyramidData.length === 0) {
    return (
      <div className="text-center py-12">
        <Mountain className="mx-auto h-12 w-12 text-gray-600 mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">No climbs yet</h3>
        <p className="text-gray-400 mb-5">Log a route to lay the first stone.</p>
        <button
          onClick={onAddClimbClick}
          className="bg-accent-600 text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-accent-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
        >
          Add your first climb
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2 mb-8">
      <PyramidBody
        rows={pyramidData}
        showCounts={showCounts}
        showSessionCounts={showSessionCounts}
        onClimbClick={onClimbClick}
        gutterBgClass="bg-gray-900"
      />
    </div>
  );
}
