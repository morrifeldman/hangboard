import { useState, useMemo } from "react";
import type { SessionRecord } from "../lib/history";
import { GearIcon } from "./icons";
import { useWorkoutStore } from "../store/useWorkoutStore";
import { useScrollRestore } from "../hooks/useScrollRestore";
import { useHistoryData, useLoad } from "../hooks/useLoad";
import { PyramidPreview } from "./pyramid/PyramidPreview";
import type { Granularity } from "../lib/gradeTrends";
import { withCurrentLiftNames } from "../lib/lifts";
import { getSchedule, normalizeDayTypes, SCHEDULE_TYPE_META } from "../lib/schedules";
import type { ScheduleDayType } from "../lib/schedules";
import { getSessions } from "../lib/history";
import { getClimbs } from "../lib/climbs";
import { toLocalDateString } from "../lib/dates";
import { OverviewCalendar } from "./progress/OverviewCalendar";
import { GradeTrendSection } from "./progress/GradeTrendSection";
import { WeightTrendsSection } from "./progress/WeightTrendsSection";
import { LiftsSection } from "./progress/LiftsSection";
import { DayDetailModal } from "./progress/DayDetailModal";

/** Chart pickers that live in the URL, so a drill-in and back doesn't reset them. */
export type ProgressView = {
  workout: "repeaters" | "max-hang";
  hold: number;
  granularity: Granularity;
  /** Null shows the first lift in the library. */
  lift: string | null;
};

type Props = {
  view: ProgressView;
  onViewChange: (patch: Partial<ProgressView>) => void;
  onEditSession: (record: SessionRecord) => void;
  onShowSettings: () => void;
  onShowPyramid: () => void;
  onShowSchedule: () => void;
  onEditLift: (liftId: string) => void;
};

type Today = { types: ScheduleDayType[]; logged: boolean };
const NOTHING_TODAY: Today = { types: [], logged: false };

/** Today's planned day + whether anything's been logged yet (home-screen nudge). */
async function loadToday(): Promise<Today> {
  const todayKey = toLocalDateString(new Date());
  const [plan, sessions, climbs] = await Promise.all([getSchedule(todayKey), getSessions(), getClimbs()]);
  const hasSession = sessions.some((s) => toLocalDateString(s.startedAt) === todayKey);
  const hasClimb = climbs.some((c) => c.date === todayKey);
  return { types: normalizeDayTypes(plan), logged: hasSession || hasClimb };
}

export function ProgressScreen({
  view,
  onViewChange,
  onEditSession,
  onShowSettings,
  onShowPyramid,
  onShowSchedule,
  onEditLift,
}: Props) {
  const { data: history, loading } = useHistoryData();
  const { data: today } = useLoad(loadToday, NOTHING_TODAY);
  const { climbs, notes } = history;
  const liftLibrary = useWorkoutStore((s) => s.lifts);
  const sessions = useMemo(
    () => history.sessions.map((r) => withCurrentLiftNames(r, liftLibrary)),
    [history.sessions, liftLibrary],
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const scrollRef = useScrollRestore<HTMLDivElement>("progress", !loading);

  const openSession = (sessionId: string) => {
    const record = sessions.find((s) => s.id === sessionId);
    if (record) onEditSession(record);
  };

  return (
    <div className="h-full bg-gray-900 flex flex-col overflow-hidden">
      <header className="bg-gray-800 px-4 py-4 flex items-center gap-3">
        <h1
          className="text-white text-[1.7rem] font-extrabold leading-none tracking-[0.01em]"
          style={{ fontStretch: "118%" }}
        >
          Cairn
        </h1>
        <button
          onClick={onShowSettings}
          aria-label="Open settings"
          data-testid="open-settings"
          className="ml-auto -mr-2 p-2 rounded-lg text-gray-400 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
        >
          <GearIcon size={22} />
        </button>
      </header>

      {today.types.length > 0 && !today.logged && (
        <button
          onClick={onShowSchedule}
          data-testid="today-banner"
          className={`mx-4 mt-3 px-3 py-2 rounded-xl text-white text-sm font-medium text-left ${SCHEDULE_TYPE_META[today.types[0]].bg}`}
        >
          Today: {today.types.map((t) => SCHEDULE_TYPE_META[t].label).join(" + ")} day
        </button>
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-500 text-sm">Loading…</div>
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex-1 flex items-center justify-center px-8 text-center">
          <p className="text-gray-500">Complete a session to see your progress.</p>
        </div>
      ) : (
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pt-5 pb-8 flex flex-col gap-8">
          <PyramidPreview climbs={climbs} onOpen={onShowPyramid} />
          <OverviewCalendar sessions={sessions} climbs={climbs} onSelectDate={setSelectedDate} />
          <GradeTrendSection
            climbs={climbs}
            granularity={view.granularity}
            onGranularityChange={(granularity) => onViewChange({ granularity })}
          />
          <WeightTrendsSection
            sessions={sessions}
            workout={view.workout}
            hold={view.hold}
            onViewChange={onViewChange}
            onOpenSession={openSession}
          />
          <LiftsSection
            sessions={sessions}
            liftId={view.lift}
            onSelectLift={(lift) => onViewChange({ lift })}
            onEditLift={onEditLift}
            onOpenSession={openSession}
          />
        </div>
      )}

      {selectedDate && (
        <DayDetailModal
          date={selectedDate}
          sessions={sessions}
          climbs={climbs}
          notes={notes}
          onClose={() => setSelectedDate(null)}
          onEditSession={onEditSession}
        />
      )}
    </div>
  );
}
