import { useState, useEffect, useCallback } from "react";
import { PyramidHeader } from "./pyramid/PyramidHeader";
import { ViewTabs } from "./pyramid/ViewTabs";
import { TimeRangeSlider } from "./pyramid/TimeRangeSlider";
import { PyramidVisualization } from "./pyramid/PyramidVisualization";
import { TimelineVisualization } from "./pyramid/TimelineVisualization";
import { Legend } from "./pyramid/Legend";
import { ClimbDetailModal } from "./pyramid/modals/ClimbDetailModal";
import { ClimbFormModal } from "./pyramid/modals/ClimbFormModal";
import type { ClimbDraft } from "./pyramid/modals/ClimbFormModal";
import { todayDateString } from "../lib/dates";
import { getClimbs, saveClimb, deleteClimb } from "../lib/climbs";
import { getMountainProjectUrl, refreshFromMountainProject } from "../lib/mpRefresh";
import type { ClimbRecord } from "../lib/climbs";
import type { ViewKey } from "../constants/climbGrades";
import { useScrollRestore } from "../hooks/useScrollRestore";

// A function, not a constant: "today" must be read when the form opens, not
// when the module first loaded (the PWA can stay open across midnight).
const initialClimb = (): ClimbDraft => ({
  route: "",
  grade: "",
  location: "",
  type: "sport",
  setting: "outdoor",
  style: "redpoint",
  climbs: 1,
  date: todayDateString(),
  notes: "",
});

type Props = { onBack: () => void; onShowScrollingPyramids: () => void };

export function PyramidScreen({ onBack, onShowScrollingPyramids }: Props) {
  const [climbs, setClimbs] = useState<ClimbRecord[]>([]);
  const currentView: ViewKey = "outdoor-sport";
  const [showSendsOnly, setShowSendsOnly] = useState(true);
  const [timeRange, setTimeRange] = useState<[number, number]>([0, 100]);
  const [selectedClimb, setSelectedClimb] = useState<ClimbRecord | null>(null);
  // The climb open in the add/edit form, or null when the form is closed.
  const [formClimb, setFormClimb] = useState<ClimbDraft | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const scrollRef = useScrollRestore<HTMLElement>("pyramid", climbs.length > 0);
  const [showCounts, setShowCounts] = useState(false);
  const [showSessionCounts, setShowSessionCounts] = useState(false);
  const [refreshNote, setRefreshNote] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setClimbs(await getClimbs());
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const handleSave = async (climb: ClimbRecord) => {
    await saveClimb(climb);
    setFormClimb(null);
    await reload();
  };

  const handleDelete = async (id: string) => {
    await deleteClimb(id);
    setSelectedClimb(null);
    await reload();
  };

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
          onClimbClick={setSelectedClimb}
          onAddClimbClick={() => setFormClimb(initialClimb())}
        />

        <TimelineVisualization
          climbs={climbs}
          currentView={currentView}
          showSendsOnly={showSendsOnly}
          timeRange={timeRange}
          onClimbClick={setSelectedClimb}
        />
      </main>

      <Legend showSendsOnly={showSendsOnly} />

      <ClimbDetailModal
        climb={selectedClimb}
        allClimbs={climbs}
        onClose={() => setSelectedClimb(null)}
        onEdit={(c) => {
          setFormClimb({ ...c });
          setSelectedClimb(null);
        }}
        onDelete={handleDelete}
      />

      {formClimb && (
        <ClimbFormModal
          key={formClimb.id ?? "new"}
          initial={formClimb}
          onClose={() => setFormClimb(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
