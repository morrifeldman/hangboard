import { useState, useEffect, useCallback } from "react";
import { PyramidHeader } from "./pyramid/PyramidHeader";
import { ViewTabs } from "./pyramid/ViewTabs";
import { TimeRangeSlider } from "./pyramid/TimeRangeSlider";
import { PyramidVisualization } from "./pyramid/PyramidVisualization";
import { TimelineVisualization } from "./pyramid/TimelineVisualization";
import { Legend } from "./pyramid/Legend";
import { ClimbDetailModal } from "./pyramid/modals/ClimbDetailModal";
import { getClimbs } from "../lib/climbs";
import { getMountainProjectUrl, refreshFromMountainProject } from "../lib/mpRefresh";
import type { ClimbRecord } from "../lib/climbs";
import type { ViewKey } from "../constants/climbGrades";
import { useScrollRestore } from "../hooks/useScrollRestore";

type Props = { onBack: () => void; onShowScrollingPyramids: () => void };

export function PyramidScreen({ onBack, onShowScrollingPyramids }: Props) {
  const [climbs, setClimbs] = useState<ClimbRecord[]>([]);
  const currentView: ViewKey = "outdoor-sport";
  const [showSendsOnly, setShowSendsOnly] = useState(true);
  const [timeRange, setTimeRange] = useState<[number, number]>([0, 100]);
  const [selectedClimb, setSelectedClimb] = useState<ClimbRecord | null>(null);
  // The grade row the open climb was tapped in, so the detail can swipe through it.
  const [selectedRow, setSelectedRow] = useState<ClimbRecord[]>([]);
  const openClimb = (c: ClimbRecord, row: ClimbRecord[]) => {
    setSelectedRow(row);
    setSelectedClimb(c);
  };
  const [isRefreshing, setIsRefreshing] = useState(false);
  const scrollRef = useScrollRestore<HTMLElement>("pyramid", climbs.length > 0);
  const [showCounts, setShowCounts] = useState(false);
  const [showSessionCounts, setShowSessionCounts] = useState(false);
  const [refreshNote, setRefreshNote] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setClimbs(await getClimbs());
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const handleRefresh = async () => {
    const mpUrl = getMountainProjectUrl();
    if (!mpUrl) {
      setRefreshNote("Add your Mountain Project tick-export URL in Settings first.");
      return;
    }
    setRefreshNote(null);
    setIsRefreshing(true);
    try {
      const count = await refreshFromMountainProject(mpUrl);
      await reload();
      setRefreshNote(`Imported ${count} climb${count === 1 ? "" : "s"}.`);
    } catch (err) {
      setRefreshNote(`Refresh failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="h-full bg-gray-900 flex flex-col">
      <PyramidHeader
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        onBack={onBack}
        showCounts={showCounts}
        onToggleCounts={() => setShowCounts((v) => !v)}
        showSendsOnly={showSendsOnly}
        onToggleSendsOnly={() => setShowSendsOnly((v) => !v)}
        showSessionCounts={showSessionCounts}
        onToggleSessionCounts={() => setShowSessionCounts((v) => !v)}
      />

      {refreshNote && (
        <div className="px-4 pt-2">
          <div className="flex items-start gap-2 rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-300">
            <span className="flex-1">{refreshNote}</span>
            <button
              onClick={() => setRefreshNote(null)}
              className="text-gray-500 hover:text-white transition-colors"
              aria-label="Dismiss"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      <ViewTabs
        currentView={currentView}
        showSendsOnly={showSendsOnly}
        climbs={climbs}
        onShowScrolling={onShowScrollingPyramids}
      />

      <main ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5">
        <TimeRangeSlider climbs={climbs} currentView={currentView} timeRange={timeRange} setTimeRange={setTimeRange} />

        <PyramidVisualization
          climbs={climbs}
          currentView={currentView}
          showSendsOnly={showSendsOnly}
          showCounts={showCounts}
          showSessionCounts={showSessionCounts}
          timeRange={timeRange}
          onClimbClick={openClimb}
          onRefreshClick={handleRefresh}
        />

        <TimelineVisualization
          climbs={climbs}
          currentView={currentView}
          showSendsOnly={showSendsOnly}
          timeRange={timeRange}
          onClimbClick={openClimb}
        />
      </main>

      <Legend showSendsOnly={showSendsOnly} />

      {/* Read-only: climbs come from Mountain Project, and Refresh replaces them
          all, so any change made here would be lost on the next refresh. */}
      <ClimbDetailModal
        climb={selectedClimb}
        allClimbs={climbs}
        siblings={selectedRow}
        onNavigate={setSelectedClimb}
        onClose={() => setSelectedClimb(null)}
      />
    </div>
  );
}
