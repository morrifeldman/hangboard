import { Mountain } from "lucide-react";
import { buildPyramid, climbsInView, getFilteredClimbs, isLeadSend } from "../../lib/climbUtils";
import { deduplicateForPyramid } from "../../lib/deduplication";
import type { ClimbRecord } from "../../lib/climbs";
import { disciplineName } from "../../constants/climbGrades";
import type { DisciplineFilter, ViewKey } from "../../constants/climbGrades";
import { PyramidBody } from "./PyramidBody";

type Props = {
  climbs: ClimbRecord[];
  currentView: ViewKey;
  discipline: DisciplineFilter;
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
  discipline,
  showSendsOnly,
  showCounts,
  showSessionCounts,
  timeRange,
  onClimbClick,
  onRefreshClick,
  friendName,
}: Props) {
  const viewAndTimeFiltered = getFilteredClimbs(climbs, currentView, timeRange, discipline);
  const deduplicatedClimbs = deduplicateForPyramid(viewAndTimeFiltered);
  const finalClimbs = showSendsOnly
    ? deduplicatedClimbs.filter(isLeadSend)
    : deduplicatedClimbs;
  const pyramidData = buildPyramid(finalClimbs, currentView);

  // TR routes are mostly top-rope ticks, which Sends only hides.
  if (pyramidData.length === 0 && discipline === "tr" && showSendsOnly && deduplicatedClimbs.length > 0) {
    return (
      <div className="text-center py-12" data-testid="pyramid-empty-discipline">
        <Mountain className="mx-auto h-12 w-12 text-gray-600 mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">No lead sends on TR routes</h3>
        <p className="text-gray-400">
          Top-rope ticks are hidden while Sends only is on. Tap the trophy to show them.
        </p>
      </div>
    );
  }

  // Some routes, just none of this kind: older imports have every route as
  // sport, and a refresh is what sorts trad and TR out of them.
  if (pyramidData.length === 0 && discipline !== "all" && climbsInView(climbs, currentView).length > 0) {
    return (
      <div className="text-center py-12" data-testid="pyramid-empty-discipline">
        <Mountain className="mx-auto h-12 w-12 text-gray-600 mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">No {disciplineName(discipline)} routes here</h3>
        <p className="text-gray-400 mb-5">
          Ticks imported before trad and TR were tracked all count as sport. Refresh to sort them.
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

  if (pyramidData.length === 0) {
    return (
      <div className="text-center py-12">
        <Mountain className="mx-auto h-12 w-12 text-gray-600 mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">No climbs yet</h3>
        <p className="text-gray-400 mb-5">
          {friendName
            ? `${friendName} has no public ${discipline === "all" ? "outdoor route" : `outdoor ${disciplineName(discipline)}`} ticks in this range, or they haven't loaded yet.`
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
