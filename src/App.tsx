import { useState, useRef, useEffect, useCallback } from "react";
import { useWorkoutStore } from "./store/useWorkoutStore";
import { useWakeLock } from "./hooks/useWakeLock";
import { WorkoutScreen } from "./components/WorkoutScreen";
import { HistoryScreen } from "./components/HistoryScreen";
import { ImportScreen } from "./components/ImportScreen";
import { GymLogScreen } from "./components/GymLogScreen";
import { ProgressScreen } from "./components/ProgressScreen";
import { PyramidScreen } from "./components/PyramidScreen";
import { ScrollingPyramidsScreen } from "./components/ScrollingPyramidsScreen";
import { SettingsScreen } from "./components/SettingsScreen";
import { NoteEditorScreen } from "./components/NoteEditorScreen";
import { ScheduleScreen } from "./components/ScheduleScreen";
import { TabBar } from "./components/TabBar";
import type { Tab } from "./components/TabBar";
import type { SessionRecord } from "./lib/history";
import type { NoteRecord } from "./lib/notes";

// Drill-in screens rendered full-screen over the tab shell (no bottom bar).
type Overlay =
  | "none"
  | "settings"
  | "pyramid"
  | "scrolling-pyramids"
  | "import"
  | "edit"
  | "gym-edit"
  | "note-add"
  | "note-edit";

// A single navigation state. We keep a stack of these in sync with the browser
// history so the system/browser Back button pops overlays and steps through tabs
// instead of leaving the app.
type NavView = {
  tab: Tab;
  overlay: Overlay;
  editRecord: SessionRecord | null;
  gymEditRecord: SessionRecord | null;
  editNote: NoteRecord | null;
};

const BASE_VIEW: NavView = {
  tab: "home",
  overlay: "none",
  editRecord: null,
  gymEditRecord: null,
  editNote: null,
};

export default function App() {
  const phase = useWorkoutStore((s) => s.phase);
  const isActive = phase !== "idle";

  const [view, setView] = useState<NavView>(BASE_VIEW);
  // The history-synced stack. Top element always mirrors `view`.
  const stackRef = useRef<NavView[]>([BASE_VIEW]);

  useWakeLock(isActive);

  // Forward navigation: push a new entry and a matching browser-history entry so
  // Back returns here. No-ops when the target is identical to the current view.
  // Side effects stay out of the setState updater (StrictMode double-invokes it).
  const go = useCallback((next: Partial<NavView>) => {
    const current = stackRef.current[stackRef.current.length - 1];
    const target: NavView = { ...current, ...next };
    const same =
      target.tab === current.tab &&
      target.overlay === current.overlay &&
      target.editRecord === current.editRecord &&
      target.gymEditRecord === current.gymEditRecord &&
      target.editNote === current.editNote;
    if (same) return;
    stackRef.current.push(target);
    window.history.pushState({ depth: stackRef.current.length }, "");
    setView(target);
  }, []);

  // Back: defer to the browser so it routes through the popstate handler below,
  // keeping our stack and the history entries consistent for both the on-screen
  // chevrons and the hardware/browser Back button.
  const back = useCallback(() => window.history.back(), []);

  useEffect(() => {
    const onPop = () => {
      if (stackRef.current.length > 1) {
        stackRef.current.pop();
        setView(stackRef.current[stackRef.current.length - 1]);
      }
      // At the base view, let the browser leave the app as usual.
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Route a session to the right editor: gym entries → GymLogScreen, board → ImportScreen.
  const openEdit = (record: SessionRecord) => {
    if (record.gymData !== undefined) {
      go({ overlay: "gym-edit", gymEditRecord: record });
    } else {
      go({ overlay: "edit", editRecord: record });
    }
  };

  const { tab, overlay, editRecord, gymEditRecord, editNote } = view;

  // Guided timer takes over the whole screen.
  if (isActive) return <WorkoutScreen />;

  // ── Overlays: full-screen, no tab bar. Back reveals the active tab beneath. ──
  if (overlay === "settings") {
    return <SettingsScreen onBack={back} />;
  }
  if (overlay === "pyramid") {
    return (
      <PyramidScreen
        onBack={back}
        onShowScrollingPyramids={() => go({ overlay: "scrolling-pyramids" })}
      />
    );
  }
  if (overlay === "scrolling-pyramids") {
    return <ScrollingPyramidsScreen onBack={back} />;
  }
  if (overlay === "import") {
    return <ImportScreen onBack={back} onSaved={back} />;
  }
  if (overlay === "edit" && editRecord) {
    return (
      <ImportScreen
        onBack={back}
        onSaved={back}
        onDeleted={back}
        initialRecord={editRecord}
      />
    );
  }
  if (overlay === "gym-edit" && gymEditRecord) {
    return (
      <div className="h-full">
        <GymLogScreen
          mode="edit"
          onBack={back}
          onSaved={back}
          onDeleted={back}
          initialRecord={gymEditRecord}
        />
      </div>
    );
  }
  if (overlay === "note-add") {
    return <NoteEditorScreen onBack={back} onSaved={back} />;
  }
  if (overlay === "note-edit" && editNote) {
    return (
      <NoteEditorScreen
        onBack={back}
        onSaved={back}
        onDeleted={back}
        initialRecord={editNote}
      />
    );
  }

  // ── Tab shell: active tab + persistent bottom bar ──
  const showSettings = () => go({ overlay: "settings" });

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0">
        {tab === "home" && (
          <ProgressScreen
            onEditSession={openEdit}
            onShowSettings={showSettings}
            onShowPyramid={() => go({ overlay: "pyramid" })}
            onShowSchedule={() => go({ tab: "schedule" })}
          />
        )}
        {tab === "schedule" && <ScheduleScreen onShowSettings={showSettings} />}
        {tab === "workout" && (
          <GymLogScreen
            mode="tab"
            onBack={() => {}}
            onSaved={() => go({ tab: "history" })}
            onShowSettings={showSettings}
          />
        )}
        {tab === "history" && (
          <HistoryScreen
            onAddNote={() => go({ overlay: "note-add" })}
            onEdit={openEdit}
            onEditNote={(note) => go({ overlay: "note-edit", editNote: note })}
            onShowSettings={showSettings}
          />
        )}
      </div>
      <TabBar active={tab} onChange={(t) => go({ tab: t })} />
    </div>
  );
}
