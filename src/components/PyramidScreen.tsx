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
import { ImportClimbsModal } from "./pyramid/modals/ImportClimbsModal";
import { getClimbs, addClimb, updateClimb, deleteClimb, replaceAllClimbs } from "../lib/climbs";
import { importMountainProjectCSV } from "../lib/mountainProjectImport";
import type { ClimbRecord } from "../lib/climbs";
import type { ViewKey } from "../constants/climbGrades";

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

type Props = { onBack: () => void };

export function PyramidScreen({ onBack }: Props) {
  const [climbs, setClimbs] = useState<ClimbRecord[]>([]);
  const [currentView, setCurrentView] = useState<ViewKey>("outdoor-sport");
  const [showSendsOnly, setShowSendsOnly] = useState(true);
  const [timeRange, setTimeRange] = useState<[number, number]>([0, 100]);
  const [selectedClimb, setSelectedClimb] = useState<ClimbRecord | null>(null);
  const [editingClimb, setEditingClimb] = useState<ClimbRecord | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImportForm, setShowImportForm] = useState(false);
  const [newClimb, setNewClimb] = useState<NewClimbData>(INITIAL_CLIMB);

  const mpUrl = localStorage.getItem("mountainProjectUrl") || "";

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

  const handleImportComplete = async (imported: ClimbRecord[], replaceAll: boolean) => {
    if (replaceAll) {
      await replaceAllClimbs(imported);
    } else {
      for (const c of imported) await addClimb(c);
    }
    await reload();
  };

  const handleRefresh = async () => {
    if (!mpUrl) return;
    try {
      const apiUrl = `/api/fetch-mp-csv?url=${encodeURIComponent(mpUrl)}`;
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error(response.statusText);
      const csvText = await response.text();
      const blob = new Blob([csvText], { type: "text/csv" });
      const file = new File([blob], "mp-refresh.csv", { type: "text/csv" });
      const imported = await importMountainProjectCSV(file);
      await replaceAllClimbs(imported);
      await reload();
    } catch (err) {
      console.error("Refresh failed:", err);
    }
  };

  return (
    <div className="h-dvh bg-gray-900 flex flex-col">
      <PyramidHeader
        onAddClimb={() => setShowAddForm(true)}
        onImport={() => setShowImportForm(true)}
        onRefresh={handleRefresh}
        canRefresh={!!mpUrl}
        onBack={onBack}
      />

      <ViewTabs
        currentView={currentView}
        setCurrentView={setCurrentView}
        showSendsOnly={showSendsOnly}
        setShowSendsOnly={setShowSendsOnly}
        climbs={climbs}
      />

      <main className="flex-1 overflow-y-auto px-4 py-4">
        <TimeRangeSlider climbs={climbs} timeRange={timeRange} setTimeRange={setTimeRange} />

        <PyramidVisualization
          climbs={climbs}
          currentView={currentView}
          showSendsOnly={showSendsOnly}
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

      <ImportClimbsModal
        isOpen={showImportForm}
        onClose={() => setShowImportForm(false)}
        onImportComplete={handleImportComplete}
      />
    </div>
  );
}
