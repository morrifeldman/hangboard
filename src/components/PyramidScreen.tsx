import { useState, useEffect, useCallback } from "react";
import { PyramidHeader } from "./pyramid/PyramidHeader";
import { ViewTabs } from "./pyramid/ViewTabs";
import { TimeRangeSlider } from "./pyramid/TimeRangeSlider";
import { PyramidVisualization } from "./pyramid/PyramidVisualization";
import { TimelineVisualization } from "./pyramid/TimelineVisualization";
import { Legend } from "./pyramid/Legend";
import { ClimbDetailModal } from "./pyramid/modals/ClimbDetailModal";
import { EditClimbModal } from "./pyramid/modals/EditClimbModal";
import { AddClimbModal } from "./pyramid/modals/AddClimbModal";
import { getClimbs, addClimb, updateClimb, deleteClimb } from "../lib/climbs";
import { getMountainProjectUrl, refreshFromMountainProject } from "../lib/mpRefresh";
import type { ClimbRecord } from "../lib/climbs";
import type { ViewKey } from "../constants/climbGrades";
import { useScrollRestore } from "../hooks/useScrollRestore";

type NewClimbData = Omit<ClimbRecord, "id">;

const INITIAL_CLIMB: NewClimbData = {
  route: "",
  grade: "",
  location: "",
  type: "sport",
  setting: "outdoor",
  style: "redpoint",
  climbs: 1,
  date: new Date().toISOString().split("T")[0],
  notes: "",
};

type Props = { onBack: () => void; onShowScrollingPyramids: () => void };

export function PyramidScreen({ onBack, onShowScrollingPyramids }: Props) {
  const [climbs, setClimbs] = useState<ClimbRecord[]>([]);
  const currentView: ViewKey = "outdoor-sport";
  const [showSendsOnly, setShowSendsOnly] = useState(true);
  const [timeRange, setTimeRange] = useState<[number, number]>([0, 100]);
  const [selectedClimb, setSelectedClimb] = useState<ClimbRecord | null>(null);
  const [editingClimb, setEditingClimb] = useState<ClimbRecord | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newClimb, setNewClimb] = useState<NewClimbData>(INITIAL_CLIMB);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const scrollRef = useScrollRestore<HTMLElement>("pyramid", climbs.length > 0);
  const [showCounts, setShowCounts] = useState(false);
  const [showSessionCounts, setShowSessionCounts] = useState(false);
  const [refreshNote, setRefreshNote] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setClimbs(await getClimbs());
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const handleAdd = async () => {
    if (!newClimb.route || !newClimb.grade) return;
    const record: ClimbRecord = { ...newClimb, id: crypto.randomUUID() };
    await addClimb(record);
    setNewClimb(INITIAL_CLIMB);
    setShowAddForm(false);
    await reload();
  };

  const handleSaveEdit = async () => {
    if (!editingClimb || !editingClimb.route || !editingClimb.grade) return;
    await updateClimb(editingClimb);
    setEditingClimb(null);
    await reload();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this climb?")) return;
    await deleteClimb(id);
    setSelectedClimb(null);
    setEditingClimb(null);
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
        onShowScrolling={onShowScrollingPyramids}
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
      />

      <main ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        <TimeRangeSlider climbs={climbs} timeRange={timeRange} setTimeRange={setTimeRange} />

        <PyramidVisualization
          climbs={climbs}
          currentView={currentView}
          showSendsOnly={showSendsOnly}
          showCounts={showCounts}
          showSessionCounts={showSessionCounts}
          timeRange={timeRange}
          onClimbClick={setSelectedClimb}
          onAddClimbClick={() => setShowAddForm(true)}
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
          setEditingClimb({ ...c });
          setSelectedClimb(null);
        }}
        onDelete={handleDelete}
      />

      <EditClimbModal
        climb={editingClimb}
        onClose={() => setEditingClimb(null)}
        onSave={handleSaveEdit}
        setEditingClimb={setEditingClimb}
      />

      <AddClimbModal
        isOpen={showAddForm}
        onClose={() => setShowAddForm(false)}
        newClimb={newClimb}
        setNewClimb={setNewClimb}
        onAddClimb={handleAdd}
      />
    </div>
  );
}
