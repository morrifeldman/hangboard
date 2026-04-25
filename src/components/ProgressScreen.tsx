import { useState, useEffect, useMemo } from "react";
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
import {
  buildTrend,
  buildCalendar,
  calendarMonthLabels,
} from "../lib/progressData";
import type { TrendPoint, CalendarDay } from "../lib/progressData";
import { HOLDS } from "../data/holds";
import { HOLDS_B } from "../data/workout-b";
import { formatWeight, shortLocation } from "../lib/format";

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = { onBack: () => void; onEditSession: (record: SessionRecord) => void };

// ─── Chart helpers ────────────────────────────────────────────────────────────

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
    ? "#22c55e"
    : "#6366f1";
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
        <text x={cx} y={cy - 9} textAnchor="middle" fill="#22c55e" fontSize={8} fontWeight="bold">
          PR
        </text>
      )}
    </g>
  );
}

// ─── Calendar helpers ─────────────────────────────────────────────────────────

function colorFor(t: CalendarDay["workoutType"]): string {
  if (t === "repeaters") return "bg-green-600";
  if (t === "max-hang") return "bg-blue-500";
  if (t === "both") return "bg-purple-500";
  if (t === "gym") return "bg-orange-500";
  if (t === "gym+hangboard") return "bg-amber-400";
  return "bg-gray-800";
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ProgressScreen({ onBack, onEditSession }: Props) {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [climbs, setClimbs] = useState<ClimbRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [workoutType, setWorkoutType] = useState<"repeaters" | "max-hang">("repeaters");
  const [holdIndex, setHoldIndex] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getSessions(), getClimbs()])
      .then(([s, c]) => { setSessions(s); setClimbs(c); })
      .finally(() => setLoading(false));
  }, []);

  // Reset hold picker when switching workout type
  const handleWorkoutType = (t: "repeaters" | "max-hang") => {
    setWorkoutType(t);
    setHoldIndex(0);
  };

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
  const selectedHold = holds[holdIndex];

  const trend = useMemo(
    () => (selectedHold ? buildTrend(sessions, selectedHold.id, workoutType) : []),
    [sessions, selectedHold, workoutType]
  );
  const chartPoints = useMemo(() => toChartPoints(trend), [trend]);

  const climbDateSet = useMemo(
    () => new Set(climbs.map((c) => c.date)),
    [climbs],
  );
  const calendarWeeks = useMemo(() => buildCalendar(sessions, climbDateSet), [sessions, climbDateSet]);
  const monthLabels = useMemo(() => calendarMonthLabels(calendarWeeks), [calendarWeeks]);
  const isTrendingUp =
    chartPoints.length >= 2 &&
    chartPoints[chartPoints.length - 1].weight >= chartPoints[0].weight;

  const lineColor = isTrendingUp ? "#22c55e" : "#6366f1";

  const hasSessions = sessions.length > 0;
  const workoutLabel = workoutType === "repeaters" ? "Repeaters" : "Max Hang";

  const dayClimbs = selectedDate ? climbs.filter((c) => c.date === selectedDate) : [];
  const daySessions = selectedDate
    ? sessions.filter((s) => new Date(s.startedAt).toISOString().slice(0, 10) === selectedDate)
    : [];

  return (
    <div className="h-dvh bg-gray-900 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-gray-800 px-4 py-4 flex items-center gap-3">
        <button
          onClick={onBack}
          aria-label="Back"
          className="text-gray-400 hover:text-white transition-colors p-1 -ml-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="text-white font-bold text-xl">Progress</h1>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-500 text-sm">Loading…</div>
        </div>
      ) : !hasSessions ? (
        <div className="flex-1 flex items-center justify-center px-8 text-center">
          <p className="text-gray-500">Complete a session to see your progress.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-6">


          {/* ── Overview calendar ── */}
          <section>
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">Overview</p>
            <div className="bg-gray-800 rounded-xl px-4 py-3">
              {/* Month labels */}
              <div className="flex gap-1 mb-1 ml-5">
                {monthLabels.map((label, i) => (
                  <div key={i} className="w-3 text-[9px] text-gray-500 text-center leading-none">
                    {label}
                  </div>
                ))}
              </div>

              {/* Grid: day-of-week labels + week columns */}
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
                    {week.map((day, di) => {
                      const active = !!(day.workoutType || day.outdoor);
                      return (
                        <div
                          key={di}
                          className={`w-3 h-3 rounded-sm relative ${
                            day.outdoor && !day.workoutType
                              ? "bg-teal-600"
                              : colorFor(day.workoutType)
                          } ${active ? "cursor-pointer" : ""}`}
                          onClick={active ? () => setSelectedDate(day.date.toISOString().slice(0, 10)) : undefined}
                          title={
                            active
                              ? `${day.date.toLocaleDateString()}: ${[day.workoutType, day.outdoor ? "outdoor" : ""].filter(Boolean).join(" + ")}`
                              : undefined
                          }
                        >
                          {day.outdoor && day.workoutType && (
                            <div className="absolute bottom-0 right-0 w-1 h-1 rounded-full bg-teal-400" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="flex gap-3 mt-3 flex-wrap">
                <LegendItem color="bg-green-600" label="Repeaters" />
                <LegendItem color="bg-blue-500" label="Max Hang" />
                <LegendItem color="bg-purple-500" label="Both" />
                <LegendItem color="bg-orange-500" label="Gym" />
                <LegendItem color="bg-amber-400" label="Gym + Board" />
                <LegendItem color="bg-teal-600" label="Outdoor" />
              </div>
            </div>
          </section>

          {/* ── Weight trends ── */}
          <section>
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">Weight Trends</p>
            <div className="bg-gray-800 rounded-xl px-4 py-3 flex flex-col gap-3">
              {/* A / B toggle */}
              <div className="flex gap-2">
                {(["repeaters", "max-hang"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => handleWorkoutType(t)}
                    className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                      workoutType === t
                        ? "bg-green-600 text-white"
                        : "bg-gray-700 text-gray-400"
                    }`}
                  >
                    {t === "repeaters" ? "Repeaters" : "Max Hang"}
                  </button>
                ))}
              </div>

              {/* Hold picker */}
              <div className="flex gap-2 overflow-x-auto -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {holds.map((hold, i) => (
                  <button
                    key={hold.id}
                    onClick={() => setHoldIndex(i)}
                    className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                      holdIndex === i
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-700 text-gray-400"
                    }`}
                  >
                    {hold.name}
                  </button>
                ))}
              </div>

              {/* Chart or empty state */}
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
                    margin={{ top: 20, right: 8, bottom: 0, left: 32 }}
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
                      tick={{ fill: "#6b7280", fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fill: "#6b7280", fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={formatWeight}
                      width={32}
                    />
                    <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3" />
                    <Tooltip
                      contentStyle={{
                        background: "#1f2937",
                        border: "none",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
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

          {/* bottom padding */}
          <div className="h-4" />
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

            {/* Climbs section */}
            {dayClimbs.length > 0 && (
              <div className="px-4 py-3">
                <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Climbing</p>
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
                          <span className="text-gray-400 text-sm font-mono">{climb.grade}</span>
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
                  <p className="text-xs uppercase tracking-wider text-gray-500">
                    {sessionTypeLabel(session.workoutType)}
                  </p>
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
                    {session.holds.map((hold) => (
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
                  <p className="text-sm text-gray-400 mt-1">{gymDataSummary(session.gymData)}</p>
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
  if (style === "flash") return "bg-blue-500/20 text-blue-400";
  if (style === "redpoint") return "bg-red-500/20 text-red-400";
  return "bg-gray-700 text-gray-400";
}


function sessionTypeLabel(type: SessionRecord["workoutType"]): string {
  if (type === "repeaters") return "Repeaters";
  if (type === "max-hang") return "Max Hang";
  if (type === "beginner") return "Beginner";
  if (type === "arc") return "ARC";
  if (type === "cir") return "CIR";
  if (type === "pe-route") return "PE Route";
  if (type === "lbc") return "LBC";
  if (type === "wbl") return "WBL";
  if (type === "performance") return "Performance";
  if (type === "hard-bouldering") return "Hard Bouldering";
  if (type === "limit-bouldering") return "Limit Bouldering";
  if (type === "injury") return "Injury";
  return type;
}

function gymDataSummary(data: NonNullable<SessionRecord["gymData"]>): string {
  if (data.type === "arc") {
    const parts = [`${data.climbMin} min`];
    if (data.routes) parts.push(`${data.routes} routes`);
    if (data.maxGrade) parts.push(`max ${data.maxGrade}`);
    return parts.join(" · ");
  }
  if (data.type === "cir") {
    return `${data.repeats} repeats · ${data.avgRestSec}s rest avg`;
  }
  if (data.type === "pe-route") {
    return `${data.reps} reps · ${data.climbSec}s on · ${data.dutyCycle} duty`;
  }
  return data.type.toUpperCase();
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2.5 h-2.5 rounded-sm ${color}`} />
      <span className="text-gray-400 text-xs">{label}</span>
    </div>
  );
}
