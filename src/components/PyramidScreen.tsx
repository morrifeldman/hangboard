import { useEffect, useRef, useState } from "react";
import { PyramidHeader } from "./pyramid/PyramidHeader";
import { ViewTabs } from "./pyramid/ViewTabs";
import { TimeRangeSlider } from "./pyramid/TimeRangeSlider";
import { PyramidVisualization } from "./pyramid/PyramidVisualization";
import { TimelineVisualization } from "./pyramid/TimelineVisualization";
import { Legend } from "./pyramid/Legend";
import { ClimbDetailModal } from "./pyramid/modals/ClimbDetailModal";
import { ClimberSwitcher } from "./pyramid/ClimberSwitcher";
import { useClimberClimbs } from "../hooks/useClimberClimbs";
import { fetchedAgo, isFriendStale, refreshFriend } from "../lib/friends";
import { getMountainProjectUrl, refreshFromMountainProject } from "../lib/mpRefresh";
import type { ClimbRecord } from "../lib/climbs";
import type { DisciplineFilter, ViewKey } from "../constants/climbGrades";
import { useScrollRestore } from "../hooks/useScrollRestore";

type Props = {
  onBack: () => void;
  onShowScrollingPyramids: () => void;
  /** The friend whose climbs to show; undefined for your own. */
  who?: string;
  onWho: (id: string | undefined) => void;
  /** All, sport or trad routes. */
  discipline: DisciplineFilter;
  onDiscipline: (d: DisciplineFilter) => void;
  onManageFriends: () => void;
};

export function PyramidScreen({
  onBack,
  onShowScrollingPyramids,
  who,
  onWho,
  discipline,
  onDiscipline,
  onManageFriends,
}: Props) {
  const { climbs, friends, friend, missing, reload } = useClimberClimbs(who);
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

  // A friend who is no longer saved: show your own climbs instead.
  useEffect(() => {
    if (missing) onWho(undefined);
  }, [missing, onWho]);

  const refreshShownFriend = async (id: string, quiet: boolean) => {
    setRefreshNote(null);
    setIsRefreshing(true);
    try {
      const updated = await refreshFriend(id);
      reload();
      if (!quiet) {
        const n = updated.climbs.length;
        setRefreshNote(`Loaded ${n} tick${n === 1 ? "" : "s"} for ${updated.name}.`);
      }
    } catch (err) {
      setRefreshNote(`Refresh failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Refetch a friend's ticks on open when the saved copy is old. Once per
  // visit, so a failing fetch isn't retried in a loop.
  const autoRefreshed = useRef(false);
  useEffect(() => {
    if (!friend || autoRefreshed.current || !isFriendStale(friend)) return;
    autoRefreshed.current = true;
    void refreshShownFriend(friend.id, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the friend first loads
  }, [friend]);

  const handleRefresh = async () => {
    if (who !== undefined) {
      await refreshShownFriend(who, false);
      return;
    }
    const mpUrl = getMountainProjectUrl();
    if (!mpUrl) {
      setRefreshNote("Find your Mountain Project account in Settings first.");
      return;
    }
    setRefreshNote(null);
    setIsRefreshing(true);
    try {
      const count = await refreshFromMountainProject(mpUrl);
      reload();
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
        discipline={discipline}
        onDiscipline={onDiscipline}
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

      <ClimberSwitcher friends={friends} who={who} onWho={onWho} onManageFriends={onManageFriends} />
      {friend && (
        <p className="px-4 pt-2 text-xs text-gray-500" data-testid="pyramid-friend-info">
          {friend.name} · {friend.climbs.length} tick{friend.climbs.length === 1 ? "" : "s"} ·{" "}
          {isRefreshing ? "updating…" : fetchedAgo(friend.fetchedAt)}
        </p>
      )}

      <ViewTabs
        currentView={currentView}
        discipline={discipline}
        showSendsOnly={showSendsOnly}
        climbs={climbs}
        onShowScrolling={onShowScrollingPyramids}
      />

      <main ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5">
        <TimeRangeSlider
          climbs={climbs}
          currentView={currentView}
          discipline={discipline}
          timeRange={timeRange}
          setTimeRange={setTimeRange}
        />

        <PyramidVisualization
          climbs={climbs}
          currentView={currentView}
          discipline={discipline}
          showSendsOnly={showSendsOnly}
          showCounts={showCounts}
          showSessionCounts={showSessionCounts}
          timeRange={timeRange}
          onClimbClick={openClimb}
          onRefreshClick={handleRefresh}
          friendName={friend?.name}
        />

        <TimelineVisualization
          climbs={climbs}
          currentView={currentView}
          discipline={discipline}
          showSendsOnly={showSendsOnly}
          timeRange={timeRange}
          onClimbClick={openClimb}
        />
      </main>

      <Legend showSendsOnly={showSendsOnly} showTrad={discipline === "all"} />

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
