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
  onClimbClick: (c: ClimbRecord, row: ClimbRecord[]) => void;
  /** The empty state's button: pull ticks from Mountain Project. */
  onRefreshClick: () => void;
  /** Set when these are a friend's climbs, so the empty state talks about them. */
  friendName?: string;
};

export function PyramidVisualization({
  climbs,
  currentView,
  showSendsOnly,
  showCounts,
  showSessionCounts,
  timeRange,
  onClimbClick,
  onRefreshClick,
  friendName,
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
        <p className="text-gray-400 mb-5">
          {friendName
            ? `${friendName} has no public outdoor sport ticks in this range, or they haven't loaded yet.`
            : "Your Mountain Project ticks show up here. Find your account in Settings, then refresh."}
        </p>
        <button
          onClick={onRefreshClick}
          className="bg-accent-500 text-gray-900 font-semibold px-5 py-2.5 rounded-lg active:bg-accent-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
        >
          Refresh from Mountain Project
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
