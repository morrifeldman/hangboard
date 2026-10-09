import { useState, useEffect, useMemo, type ReactNode } from "react";
import { RouteHistoryModal } from "./RouteHistoryModal";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { getSessions } from "../lib/history";
import type { SessionRecord } from "../lib/history";
import { getClimbs } from "../lib/climbs";
import type { ClimbRecord } from "../lib/climbs";
import { getNotes } from "../lib/notes";
import type { NoteRecord } from "../lib/notes";
import { GearIcon, PencilIcon } from "./icons";
import { useWorkoutStore } from "../store/useWorkoutStore";
import { useScrollRestore } from "../hooks/useScrollRestore";
import { PyramidPreview } from "./pyramid/PyramidPreview";
import {
  buildTrend,
  buildCalendar,
  calendarMonthLabels,
} from "../lib/progressData";
import type { TrendPoint, CalendarDay } from "../lib/progressData";
import { buildGradeTrend, gradeLabel } from "../lib/gradeTrends";
import type { Granularity } from "../lib/gradeTrends";
import { HOLDS, warmupVolume } from "../data/holds";
import { HOLDS_B, isWarmupHoldId } from "../data/workout-b";
import { formatWeight, shortLocation } from "../lib/format";
import { sessionLabel, gymSummaryParts, summaryText } from "../lib/sessionSummary";
import { buildLiftTrend, formatScheme, withCurrentLiftNames } from "../lib/lifts";
import {
  getSchedule,
  normalizeDayTypes,
  SCHEDULE_TYPE_META,
} from "../lib/schedules";
import { toLocalDateString } from "../lib/dates";
import { Pill, PillRow, Segmented } from "./ui";
import type { ScheduleDayType } from "../lib/schedules";

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Chart helpers ────────────────────────────────────────────────────────────

// Matches getStyleColor, so a flash is the same yellow in the pyramid and the chart.
const STYLE_HEX = { onsight: "#22c55e", flash: "#eab308", redpoint: "#ef4444" } as const;
const ACCENT_HEX = "#22c55e";

const AXIS_TICK = { fill: "#6b7280", fontSize: 10 };
const AXIS_NUM_TICK = { ...AXIS_TICK, fontSize: 12, className: "font-num" };
const TOOLTIP_STYLE = { background: "#111827", border: "1px solid #374151", borderRadius: 8, fontSize: 12 };

const GRANULARITIES: { value: Granularity; label: string }[] = [
  { value: "months", label: "Months" },
  { value: "seasons", label: "Seasons" },
  { value: "years", label: "Years" },
];

const WORKOUTS: { value: ProgressView["workout"]; label: string }[] = [
  { value: "repeaters", label: "Repeaters" },
  { value: "max-hang", label: "Max Hang" },
];

type ChartPoint = { weight: number; label: string; bailed: boolean; isPR: boolean; setFailed: boolean; isBeginner: boolean; sessionId: string };

function toChartPoints(trend: TrendPoint[]): ChartPoint[] {
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return trend.map((p) => ({
    weight: p.weight,
    label: `${MONTHS[p.date.getMonth()]} ${p.date.getDate()}`,
    bailed: p.bailed,
    isPR: p.isPR,
    setFailed: p.setFailed,
    isBeginner: p.isBeginner,
    sessionId: p.sessionId,
  }));
}

type DotProps = {
  cx?: number;
  cy?: number;
  payload?: ChartPoint;
  onClick?: (sessionId: string) => void;
};

function CustomDot({ cx, cy, payload, onClick }: DotProps) {
  if (cx == null || cy == null || payload == null) return null;
  const r = payload.isBeginner ? 3 : payload.isPR ? 5 : 3;
  const color = payload.isBeginner
    ? "#6b7280" // muted gray for beginner — de-emphasized
    : payload.setFailed
    ? "#f59e0b"
    : payload.bailed
    ? "#6b7280"
    : payload.isPR
    ? ACCENT_HEX
    : "#d1d5db";
  const fill = (payload.bailed && !payload.setFailed) || payload.isBeginner ? "transparent" : color;

  return (
    <g
      style={{ cursor: "pointer" }}
      onClick={() => onClick?.(payload.sessionId)}
    >
      {/* large invisible tap target for mobile */}
      <circle cx={cx} cy={cy} r={14} fill="transparent" />
      {payload.isBeginner ? (
        <rect
          x={cx - r} y={cy - r} width={r * 2} height={r * 2}
          transform={`rotate(45, ${cx}, ${cy})`}
          fill={fill} stroke={color} strokeWidth={1.5}
        />
      ) : (
        <circle cx={cx} cy={cy} r={r} fill={fill} stroke={color} strokeWidth={1.5} />
      )}
      {payload.isPR && (
        <text x={cx} y={cy - 9} textAnchor="middle" fill={ACCENT_HEX} fontSize={9} className="font-num">
          PR
        </text>
      )}
    </g>
  );
}

// ─── Calendar helpers ─────────────────────────────────────────────────────────

/**
 * One heatmap cell. Each activity bucket present that day contributes an equal
 * slice: 1 → solid, 2 → halves, 3 → thirds, 4 → quarters (2×2). This keeps every
 * bucket visible on shared days instead of one masking the others.
 */
function CalendarCell({ day, onSelect }: { day: CalendarDay; onSelect: () => void }) {
  const segments: { key: string; color: string; label: string }[] = [];
  if (day.gym) segments.push({ key: "gym", color: "bg-amber-500", label: "gym" });
  if (day.cardio) segments.push({ key: "cardio", color: "bg-rose-500", label: "cardio" });
  if (day.stretching) segments.push({ key: "stretching", color: "bg-violet-500", label: "stretching" });
  if (day.outdoor) segments.push({ key: "outdoor", color: "bg-teal-600", label: "outdoor" });

  const active = segments.length > 0;
  const title = active
    ? `${day.date.toLocaleDateString()}: ${segments.map((s) => s.label).join(" + ")}`
    : day.isToday
      ? "Today"
      : undefined;

  let inner: ReactNode = null;
  if (segments.length === 4) {
    inner = (
      <div className="grid grid-cols-2 grid-rows-2 w-full h-full">
        {segments.map((s) => (
          <div key={s.key} className={s.color} />
        ))}
      </div>
    );
  } else if (segments.length > 0) {
    inner = (
      <div className="flex w-full h-full">
        {segments.map((s) => (
          <div key={s.key} className={`flex-1 ${s.color}`} />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`w-3 h-3 rounded-sm overflow-hidden ${active ? "cursor-pointer" : "bg-gray-800"} ${
        day.isToday ? "ring-1 ring-white ring-offset-1 ring-offset-gray-800" : ""
      }`}
      onClick={active ? onSelect : undefined}
      title={title}
    >
      {inner}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ProgressScreen({
  view,
  onViewChange,
  onEditSession,
  onShowSettings,
  onShowPyramid,
  onShowSchedule,
  onEditLift,
}: Props) {
  const [storedSessions, setSessions] = useState<SessionRecord[]>([]);
  const [climbs, setClimbs] = useState<ClimbRecord[]>([]);
  const liftLibrary = useWorkoutStore((s) => s.lifts);
  const sessions = useMemo(
    () => storedSessions.map((r) => withCurrentLiftNames(r, liftLibrary)),
    [storedSessions, liftLibrary],
  );
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayTypes, setTodayTypes] = useState<ScheduleDayType[]>([]);
  const [loggedToday, setLoggedToday] = useState(false);
  const workoutType = view.workout;
  const setHoldIndex = (i: number) => onViewChange({ hold: i });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const granularity = view.granularity;
  const setGranularity = (g: Granularity) => onViewChange({ granularity: g });
  const [rangeStart, setRangeStart] = useState(0);
  const [rangeEnd, setRangeEnd] = useState(0);
  const scrollRef = useScrollRestore<HTMLDivElement>("progress", !loading);

  useEffect(() => {
    Promise.all([getSessions(), getClimbs(), getNotes()])
      .then(([s, c, n]) => { setSessions(s); setClimbs(c); setNotes(n); })
      .finally(() => setLoading(false));
  }, []);

  // Today's planned day + whether anything's been logged yet (home-screen nudge).
  useEffect(() => {
    const todayKey = toLocalDateString(new Date());
    Promise.all([getSchedule(todayKey), getSessions(), getClimbs()])
      .then(([plan, sess, cl]) => {
        setTodayTypes(normalizeDayTypes(plan));
        const hasSession = sess.some(
          (s) => toLocalDateString(new Date(s.startedAt)) === todayKey,
        );
        const hasClimb = cl.some((c) => c.date === todayKey);
        setLoggedToday(hasSession || hasClimb);
      })
      .catch(() => {});
  }, []);

  // Reset hold picker when switching workout type
  // The two workouts have different hold lists, so the picker starts over.
  const handleWorkoutType = (t: "repeaters" | "max-hang") =>
    onViewChange({ workout: t, hold: 0 });

  // Extra holds from imported "a" sessions (e.g. "crimp") not in the standard HOLDS array
  const extraHolds = useMemo(() => {
    if (workoutType !== "repeaters") return [];
    const knownIds = new Set(HOLDS.map((h) => h.id));
    const result: { id: string; name: string }[] = [];
    const seen = new Set<string>();
    for (const s of sessions) {
      if (s.workoutType !== "repeaters" && s.workoutType !== "beginner") continue;
      for (const h of s.holds) {
        if (!knownIds.has(h.holdId) && !seen.has(h.holdId)) {
          result.push({ id: h.holdId, name: h.holdName });
          seen.add(h.holdId);
        }
      }
    }
    return result;
  }, [sessions, workoutType]);

  const holds: { id: string; name: string }[] =
    workoutType === "repeaters"
      ? [...HOLDS.filter((h) => !h.skipProgression), ...extraHolds]
      : HOLDS_B.filter((h) => !h.skipProgression);
  // A hand-edited or stale URL can point past the end of this workout's holds.
  const holdIndex = Math.min(Math.max(view.hold, 0), Math.max(holds.length - 1, 0));
  const selectedHold = holds[holdIndex];

  const trend = useMemo(
    () => (selectedHold ? buildTrend(sessions, selectedHold.id, workoutType) : []),
    [sessions, selectedHold, workoutType]
  );
  const chartPoints = useMemo(() => toChartPoints(trend), [trend]);

  // A deleted lift can linger in the URL; fall back rather than chart nothing.
  const selectedLift = liftLibrary.find((l) => l.id === view.lift) ?? liftLibrary[0];
  const liftChartPoints = useMemo(
    () => (selectedLift ? toChartPoints(buildLiftTrend(sessions, selectedLift.id)) : []),
    [sessions, selectedLift],
  );
  const openSession = (sessionId: string) => {
    const record = sessions.find((s) => s.id === sessionId);
    if (record) onEditSession(record);
  };

  const climbDateSet = useMemo(
    () => new Set(climbs.map((c) => c.date)),
    [climbs],
  );
  const calendarWeeks = useMemo(
    () => buildCalendar(sessions, climbDateSet),
    [sessions, climbDateSet],
  );
  const monthLabels = useMemo(() => calendarMonthLabels(calendarWeeks), [calendarWeeks]);
  const isTrendingUp =
    chartPoints.length >= 2 &&
    chartPoints[chartPoints.length - 1].weight >= chartPoints[0].weight;

  const gradeTrendAll = useMemo(
    () => buildGradeTrend(climbs, granularity),
    [climbs, granularity],
  );

  // Reset range to full whenever the bucket list changes (granularity switch or first load).
  useEffect(() => {
    setRangeStart(0);
    setRangeEnd(Math.max(0, gradeTrendAll.length - 1));
  }, [gradeTrendAll.length]);

  const visibleGradeTrend = useMemo(() => {
    if (gradeTrendAll.length === 0) return [];
    const s = Math.min(rangeStart, rangeEnd);
    const e = Math.max(rangeStart, rangeEnd);
    return gradeTrendAll.slice(s, e + 1);
  }, [gradeTrendAll, rangeStart, rangeEnd]);

  const gradeYDomain = useMemo<[number, number] | undefined>(() => {
    const vals: number[] = [];
    for (const p of visibleGradeTrend) {
      if (p.onsight !== null) vals.push(p.onsight);
      if (p.flash !== null) vals.push(p.flash);
      if (p.redpoint !== null) vals.push(p.redpoint);
    }
    if (vals.length === 0) return undefined;
    return [Math.max(0, Math.min(...vals) - 1), Math.min(15, Math.max(...vals) + 1)];
  }, [visibleGradeTrend]);

  const lineColor = isTrendingUp ? ACCENT_HEX : "#6b7280";

  const hasSessions = sessions.length > 0;
  const workoutLabel = workoutType === "repeaters" ? "Repeaters" : "Max Hang";

  const dayClimbs = selectedDate ? climbs.filter((c) => c.date === selectedDate) : [];
  const daySessions = selectedDate
    ? sessions.filter((s) => {
        const d = new Date(s.startedAt);
        const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        return local === selectedDate;
      })
    : [];
  const dayNotes = selectedDate ? notes.filter((n) => n.date === selectedDate) : [];

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

      {todayTypes.length > 0 && !loggedToday && (
        <button
          onClick={onShowSchedule}
          data-testid="today-banner"
          className={`mx-4 mt-3 px-3 py-2 rounded-xl text-white text-sm font-medium text-left ${SCHEDULE_TYPE_META[todayTypes[0]].bg}`}
        >
          Today: {todayTypes.map((t) => SCHEDULE_TYPE_META[t].label).join(" + ")} day
        </button>
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-500 text-sm">Loading…</div>
        </div>
      ) : !hasSessions ? (
        <div className="flex-1 flex items-center justify-center px-8 text-center">
          <p className="text-gray-500">Complete a session to see your progress.</p>
        </div>
      ) : (
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pt-5 pb-8 flex flex-col gap-8">
          <PyramidPreview climbs={climbs} onOpen={onShowPyramid} />

          <section className="flex flex-col gap-2.5">
            <SectionHeading>Activity</SectionHeading>
            <div className="bg-gray-800 rounded-2xl px-4 py-3">
              <div className="flex gap-1 mb-1 ml-5">
                {monthLabels.map((label, i) => (
                  <div key={i} className="w-3 text-[9px] text-gray-500 text-center leading-none">
                    {label}
                  </div>
                ))}
              </div>

              <div className="flex gap-1">
                <div className="flex flex-col gap-1 mr-1 mt-0.5">
                  {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                    <div key={i} className="text-gray-600 text-[9px] h-3 flex items-center w-3 justify-center">
                      {d}
                    </div>
                  ))}
                </div>
                {calendarWeeks.map((week, wi) => (
                  <div key={wi} className="flex flex-col gap-1">
                    {week.map((day, di) => (
                      <CalendarCell
                        key={di}
                        day={day}
                        onSelect={() => setSelectedDate(toLocalDateString(day.date))}
                      />
                    ))}
                  </div>
                ))}
              </div>

              <div className="flex gap-x-4 gap-y-1 mt-3 pt-3 border-t border-gray-700/60 flex-wrap">
                <LegendItem color="bg-teal-600" label="Outdoor" />
                <LegendItem color="bg-amber-500" label="Gym" />
                <LegendItem color="bg-rose-500" label="Cardio" />
                <LegendItem color="bg-violet-500" label="Stretching" />
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-2.5">
            <SectionHeading>Route grades over time</SectionHeading>
            <div className="bg-gray-800 rounded-2xl px-4 py-3 flex flex-col gap-4">
              <Segmented
                label="Group by"
                options={GRANULARITIES}
                value={granularity}
                onChange={setGranularity}
              />

              {gradeTrendAll.length === 0 ? (
                <div className="h-[180px] flex items-center justify-center">
                  <p className="text-gray-600 text-sm">No outdoor sport climbs yet</p>
                </div>
              ) : (
                <>
                  <RangeSlider
                    max={gradeTrendAll.length - 1}
                    start={Math.min(rangeStart, rangeEnd)}
                    end={Math.max(rangeStart, rangeEnd)}
                    startLabel={gradeTrendAll[Math.min(rangeStart, rangeEnd)]?.label ?? ""}
                    endLabel={gradeTrendAll[Math.max(rangeStart, rangeEnd)]?.label ?? ""}
                    onChange={(s, e) => { setRangeStart(s); setRangeEnd(e); }}
                  />

                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={visibleGradeTrend} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                      <XAxis
                        dataKey="label"
                        tick={AXIS_TICK}
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        domain={gradeYDomain ?? [0, 15]}
                        type="number"
                        ticks={gradeYDomain ? rangeTicks(gradeYDomain[0], gradeYDomain[1]) : undefined}
                        tick={AXIS_NUM_TICK}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v: number) => gradeLabel(v)}
                        width={40}
                      />
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        labelStyle={{ color: "#9ca3af" }}
                        formatter={(v: number | undefined, name: string | undefined) => [v == null ? "—" : gradeLabel(v), name ?? ""]}
                      />
                      <Line type="monotone" dataKey="onsight"  name="Onsight"  stroke={STYLE_HEX.onsight}  strokeWidth={2} dot={{ r: 3 }} connectNulls />
                      <Line type="monotone" dataKey="flash"    name="Flash"    stroke={STYLE_HEX.flash}    strokeWidth={2} dot={{ r: 3 }} connectNulls />
                      <Line type="monotone" dataKey="redpoint" name="Redpoint" stroke={STYLE_HEX.redpoint} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>

                  <div className="flex gap-4 flex-wrap">
                    <LegendItem color="bg-green-500" label="Onsight" />
                    <LegendItem color="bg-yellow-500" label="Flash" />
                    <LegendItem color="bg-red-500" label="Redpoint" />
                  </div>
                </>
              )}
            </div>
          </section>

          <section className="flex flex-col gap-2.5">
            <SectionHeading>Hangboard weights</SectionHeading>
            <div className="bg-gray-800 rounded-2xl px-4 py-3 flex flex-col gap-3">
              <Segmented
                label="Workout"
                options={WORKOUTS}
                value={workoutType}
                onChange={handleWorkoutType}
              />

              <PillRow className="-mx-4 px-4">
                {holds.map((hold, i) => (
                  <Pill key={hold.id} size="sm" selected={holdIndex === i} onClick={() => setHoldIndex(i)}>
                    {hold.name}
                  </Pill>
                ))}
              </PillRow>

              {chartPoints.length < 2 ? (
                <div className="h-[160px] flex items-center justify-center">
                  <p className="text-gray-600 text-sm">
                    {chartPoints.length === 0
                      ? `No ${workoutLabel} sessions yet`
                      : "Need at least 2 sessions to show trend"}
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart
                    data={chartPoints}
                    margin={{ top: 20, right: 8, bottom: 0, left: 0 }}
                    style={{ cursor: "pointer" }}
                    onClick={(data) => {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const id = (data as any)?.activePayload?.[0]?.payload?.sessionId as string | undefined;
                      if (!id) return;
                      const record = sessions.find((s) => s.id === id);
                      if (record) onEditSession(record);
                    }}
                  >
                    <XAxis
                      dataKey="label"
                      tick={AXIS_TICK}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={AXIS_NUM_TICK}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={formatWeight}
                      width={36}
                    />
                    <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3" />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      labelStyle={{ color: "#9ca3af" }}
                      formatter={(v: number | undefined) => [v != null ? formatWeight(v) : "—", "Weight"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="weight"
                      stroke={lineColor}
                      strokeWidth={2}
                      dot={(props) => (
                        <CustomDot
                          {...props}
                          onClick={(sessionId) => {
                            const record = sessions.find((s) => s.id === sessionId);
                            if (record) onEditSession(record);
                          }}
                        />
                      )}
                      activeDot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>

          {selectedLift && (
            <section className="flex flex-col gap-2.5">
              <SectionHeading>Lifts</SectionHeading>
              <div className="bg-gray-800 rounded-2xl px-4 py-3">
                {liftChartPoints.length < 2 ? (
                  <div className="h-[160px] flex items-center justify-center">
                    <p className="text-gray-600 text-sm">
                      {liftChartPoints.length === 0
                        ? `No ${selectedLift.name} sessions yet`
                        : "Need at least 2 sessions to show trend"}
                    </p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={liftChartPoints} margin={{ top: 20, right: 8, bottom: 0, left: 0 }}>
                      <XAxis
                        dataKey="label"
                        tick={AXIS_TICK}
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        domain={[
                          (min: number) => Math.max(0, Math.floor((min - 5) / 10) * 10),
                          (max: number) => Math.ceil((max + 5) / 10) * 10,
                        ]}
                        allowDecimals={false}
                        tick={AXIS_NUM_TICK}
                        tickLine={false}
                        axisLine={false}
                        width={36}
                      />
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        labelStyle={{ color: "#9ca3af" }}
                        formatter={(v: number | undefined) => [v != null ? `${v} lb` : "—", "Top set"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="weight"
                        stroke={
                          liftChartPoints[liftChartPoints.length - 1].weight >= liftChartPoints[0].weight
                            ? ACCENT_HEX
                            : "#6b7280"
                        }
                        strokeWidth={2}
                        dot={(props) => <CustomDot {...props} onClick={openSession} />}
                        activeDot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* The list doubles as the chart's picker, so there are no lift pills. */}
              <div className="bg-gray-800 rounded-2xl divide-y divide-gray-700/60" data-testid="lift-library">
                {liftLibrary.map((lift) => {
                  const selected = lift.id === selectedLift.id;
                  return (
                    <div key={lift.id} className="flex items-center">
                      <button
                        type="button"
                        onClick={() => onViewChange({ lift: lift.id })}
                        aria-pressed={selected}
                        className="flex-1 min-w-0 text-left px-4 py-3 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-400"
                      >
                        <span className={`block text-sm font-semibold truncate ${selected ? "text-accent-400" : "text-gray-200"}`}>
                          {lift.name}
                        </span>
                        <span className="block text-sm text-gray-400 font-num">{formatScheme(lift)}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditLift(lift.id)}
                        aria-label={`Edit ${lift.name}`}
                        className="shrink-0 p-3 mr-1 rounded-lg text-gray-500 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
                      >
                        <PencilIcon size={18} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ── Day detail modal ── */}
      {selectedDate && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-50"
            onClick={() => setSelectedDate(null)}
          />
          <div className="fixed bottom-0 left-0 right-0 bg-gray-900 rounded-t-2xl z-50 max-h-[80vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-800 sticky top-0 bg-gray-900">
              <h2 className="text-white font-semibold">
                {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", {
                  weekday: "short", month: "short", day: "numeric", year: "numeric",
                })}
              </h2>
              <button
                onClick={() => setSelectedDate(null)}
                aria-label="Close"
                className="text-gray-400 hover:text-white p-1 -mr-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Notes section */}
            {dayNotes.length > 0 && (
              <div className="px-4 py-3">
                <h3 className="text-sm font-semibold text-gray-300 mb-2">Notes</h3>
                <div className="flex flex-col gap-2.5">
                  {dayNotes.map((note) => (
                    <div key={note.id} className="flex flex-col gap-1">
                      {note.category && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium self-start bg-purple-500/20 text-purple-300">
                          {note.category}
                        </span>
                      )}
                      <p className="text-sm text-gray-200 whitespace-pre-wrap break-words">{note.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Climbs section */}
            {dayClimbs.length > 0 && (
              <div className="px-4 py-3">
                <h3 className="text-sm font-semibold text-gray-300 mb-2">Climbing</h3>
                <div className="flex flex-col gap-2.5">
                  {dayClimbs.map((climb) => (
                    <button
                      key={climb.id}
                      className="flex items-start justify-between gap-2 text-left w-full hover:bg-gray-800 rounded-lg px-2 py-1 -mx-2 transition-colors"
                      onClick={() => setSelectedRoute(climb.route)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white text-sm font-medium">{climb.route}</span>
                          <span className="text-gray-300 text-[15px] font-num">{climb.grade}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${climbStyleBadge(climb.style)}`}>
                            {climb.style}
                          </span>
                        </div>
                        {climb.notes && (
                          <p className="text-gray-500 text-xs italic mt-0.5">{climb.notes}</p>
                        )}
                      </div>
                      <span className="text-gray-500 text-xs text-right shrink-0 mt-0.5">
                        {shortLocation(climb.location)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Workout sections */}
            {daySessions.map((session) => (
              <div key={session.id} className="px-4 py-3 border-t border-gray-800">
                <div className="flex items-center justify-between mb-2">
                  <button
                    className="text-sm font-semibold text-gray-300 hover:text-white transition-colors text-left"
                    onClick={() => onEditSession(session)}
                  >
                    {sessionLabel(session)}
                  </button>
                  <div className="flex items-center gap-2">
                    {session.bailed && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">Bailed</span>
                    )}
                    <span className="text-gray-500 text-xs">
                      {new Date(session.startedAt).toLocaleTimeString("en-US", {
                        hour: "numeric", minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                {session.holds.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    {session.holds.some((h) => isWarmupHoldId(h.holdId)) && (
                      <div className="-mx-2 mb-1 rounded-lg bg-teal-400/[0.06] px-2 py-1.5">
                        <p className="mb-1 text-xs font-semibold text-teal-300/80">
                          Warm-up
                        </p>
                        <div className="flex flex-col gap-1">
                          {session.holds.filter((h) => isWarmupHoldId(h.holdId)).map((hold) => {
                            const sets = [hold.set1, hold.set2, hold.set3].filter((x) => x != null);
                            const done = sets.every((x) => x.completed);
                            return (
                              <div key={hold.holdId} className="flex items-center justify-between gap-3">
                                <span className={`text-sm truncate ${done ? "text-gray-300" : "text-gray-500 line-through"}`}>
                                  {hold.holdName}
                                </span>
                                <span className="text-xs font-medium tabular-nums text-teal-300/90">
                                  {warmupVolume(sets.map((x) => x.reps))}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {session.holds.filter((h) => !isWarmupHoldId(h.holdId)).map((hold) => (
                      <div key={hold.holdId} className="flex items-center justify-between">
                        <span className="text-sm text-gray-200">{hold.holdName}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500">
                            S1 <span className={hold.set1.completed ? "text-gray-300" : "text-gray-500 line-through"}>{formatWeight(hold.set1.weight)}</span>
                          </span>
                          {hold.set2 && (
                            <span className="text-xs text-gray-500">
                              S2 <span className={hold.set2.completed ? "text-gray-300" : "text-gray-500 line-through"}>{formatWeight(hold.set2.weight)}</span>
                            </span>
                          )}
                          {hold.set3 && (
                            <span className="text-xs text-gray-500">
                              S3 <span className={hold.set3.completed ? "text-gray-300" : "text-gray-500 line-through"}>{formatWeight(hold.set3.weight)}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {session.gymData && (
                  <p className="text-sm text-gray-400 mt-1">{summaryText(gymSummaryParts(session.gymData))}</p>
                )}

                {session.notes && (
                  <p className="text-gray-500 text-xs italic mt-2">{session.notes}</p>
                )}
              </div>
            ))}

            <div className="h-8" />
          </div>
        </>
      )}

      {selectedRoute && (
        <RouteHistoryModal
          routeName={selectedRoute}
          allClimbs={climbs}
          onClose={() => setSelectedRoute(null)}
        />
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function climbStyleBadge(style: ClimbRecord["style"]): string {
  if (style === "onsight") return "bg-green-500/20 text-green-400";
  if (style === "flash") return "bg-yellow-500/20 text-yellow-400";
  if (style === "redpoint") return "bg-red-500/20 text-red-400";
  return "bg-gray-700 text-gray-400";
}

function rangeTicks(min: number, max: number): number[] {
  const out: number[] = [];
  for (let i = min; i <= max; i++) out.push(i);
  return out;
}

type RangeSliderProps = {
  max: number;
  start: number;
  end: number;
  startLabel: string;
  endLabel: string;
  onChange: (start: number, end: number) => void;
};

function RangeSlider({ max, start, end, startLabel, endLabel, onChange }: RangeSliderProps) {
  const pct = (v: number) => (max === 0 ? 0 : (v / max) * 100);
  const thumbCls =
    "absolute inset-x-0 top-0 w-full h-10 appearance-none bg-transparent pointer-events-none " +
    "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none " +
    "[&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full " +
    "[&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-accent-500 " +
    "[&::-webkit-slider-thumb]:cursor-pointer focus:outline-none focus-visible:[&::-webkit-slider-thumb]:ring-2 focus-visible:[&::-webkit-slider-thumb]:ring-accent-400 " +
    "[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 " +
    "[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 " +
    "[&::-moz-range-thumb]:border-accent-500 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-solid";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs text-gray-400 px-0.5">
        <span>{startLabel}</span>
        <span>{endLabel}</span>
      </div>
      <div className="relative h-10">
        <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1 bg-gray-700 rounded" />
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1 bg-accent-500 rounded"
          style={{ left: `${pct(start)}%`, right: `${100 - pct(end)}%` }}
        />
        <input
          type="range" min={0} max={max} step={1} value={start}
          aria-label="Range start"
          onChange={(e) => onChange(Math.min(Number(e.target.value), end), end)}
          className={thumbCls}
        />
        <input
          type="range" min={0} max={max} step={1} value={end}
          aria-label="Range end"
          onChange={(e) => onChange(start, Math.max(Number(e.target.value), start))}
          className={thumbCls}
        />
      </div>
    </div>
  );
}


function SectionHeading({ children }: { children: ReactNode }) {
  return <h2 className="text-sm font-semibold text-gray-300">{children}</h2>;
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2.5 h-2.5 rounded-sm ${color}`} />
      <span className="text-gray-400 text-xs">{label}</span>
    </div>
  );
}
