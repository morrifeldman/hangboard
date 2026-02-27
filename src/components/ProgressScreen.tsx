import { useState, useEffect, useMemo } from "react";
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
import {
  buildTrend,
  buildCalendar,
  calendarMonthLabels,
  computeStats,
} from "../lib/progressData";
import type { TrendPoint, CalendarDay } from "../lib/progressData";
import { HOLDS } from "../data/holds";
import { HOLDS_B } from "../data/workout-b";
import { formatWeight } from "../lib/format";

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = { onBack: () => void };

// ─── Chart helpers ────────────────────────────────────────────────────────────

type ChartPoint = { weight: number; label: string; bailed: boolean; isPR: boolean };

function toChartPoints(trend: TrendPoint[]): ChartPoint[] {
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return trend.map((p) => ({
    weight: p.weight,
    label: `${MONTHS[p.date.getMonth()]} ${p.date.getDate()}`,
    bailed: p.bailed,
    isPR: p.isPR,
  }));
}

type DotProps = {
  cx?: number;
  cy?: number;
  payload?: ChartPoint;
};

function CustomDot({ cx, cy, payload }: DotProps) {
  if (cx == null || cy == null || payload == null) return null;
  const r = payload.isPR ? 5 : 3;
  const fill = payload.bailed ? "transparent" : (payload.isPR ? "#22c55e" : "#6366f1");
  const stroke = payload.bailed ? "#6b7280" : (payload.isPR ? "#22c55e" : "#6366f1");

  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={fill} stroke={stroke} strokeWidth={1.5} />
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
  if (t === "a") return "bg-green-600";
  if (t === "b") return "bg-blue-500";
  if (t === "both") return "bg-purple-500";
  return "bg-gray-800";
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ProgressScreen({ onBack }: Props) {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [workoutType, setWorkoutType] = useState<"a" | "b">("a");
  const [holdIndex, setHoldIndex] = useState(0);

  useEffect(() => {
    getSessions()
      .then(setSessions)
      .finally(() => setLoading(false));
  }, []);

  // Reset hold picker when switching workout type
  const handleWorkoutType = (t: "a" | "b") => {
    setWorkoutType(t);
    setHoldIndex(0);
  };

  // Extra holds from imported "a" sessions (e.g. "crimp") not in the standard HOLDS array
  const extraHolds = useMemo(() => {
    if (workoutType !== "a") return [];
    const knownIds = new Set(HOLDS.map((h) => h.id));
    const result: { id: string; name: string }[] = [];
    const seen = new Set<string>();
    for (const s of sessions) {
      if (s.workoutType !== "a") continue;
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
    workoutType === "a" ? [...HOLDS, ...extraHolds] : HOLDS_B;
  const selectedHold = holds[holdIndex];

  const trend = useMemo(
    () => (selectedHold ? buildTrend(sessions, selectedHold.id, workoutType) : []),
    [sessions, selectedHold, workoutType]
  );
  const chartPoints = useMemo(() => toChartPoints(trend), [trend]);

  const calendarWeeks = useMemo(() => buildCalendar(sessions), [sessions]);
  const monthLabels = useMemo(() => calendarMonthLabels(calendarWeeks), [calendarWeeks]);
  const stats = useMemo(() => computeStats(sessions), [sessions]);

  const isTrendingUp =
    chartPoints.length >= 2 &&
    chartPoints[chartPoints.length - 1].weight >= chartPoints[0].weight;

  const lineColor = isTrendingUp ? "#22c55e" : "#6366f1";

  const hasSessions = sessions.length > 0;
  const workoutLabel = workoutType === "a" ? "Repeaters" : "Max Hang";

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

          {/* ── Stats ── */}
          <section>
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">Stats</p>
            <div className="bg-gray-800 rounded-xl px-4 py-3 flex items-center justify-center">
              <StatPill value={String(stats.totalCompleted)} label="sessions completed" />
            </div>
          </section>

          {/* ── Consistency calendar ── */}
          <section>
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">Consistency</p>
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
                  {["M", "", "W", "", "F", "", "S"].map((d, i) => (
                    <div key={i} className="text-gray-600 text-[9px] h-3 flex items-center w-3 justify-center">
                      {d}
                    </div>
                  ))}
                </div>
                {calendarWeeks.map((week, wi) => (
                  <div key={wi} className="flex flex-col gap-1">
                    {week.map((day, di) => (
                      <div
                        key={di}
                        className={`w-3 h-3 rounded-sm ${colorFor(day.workoutType)}`}
                        title={day.workoutType ? `${day.date.toLocaleDateString()}: ${day.workoutType}` : undefined}
                      />
                    ))}
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="flex gap-3 mt-3 flex-wrap">
                <LegendItem color="bg-green-600" label="Repeaters" />
                <LegendItem color="bg-blue-500" label="Max Hang" />
                <LegendItem color="bg-purple-500" label="Both" />
              </div>
            </div>
          </section>

          {/* ── Weight trends ── */}
          <section>
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">Weight Trends</p>
            <div className="bg-gray-800 rounded-xl px-4 py-3 flex flex-col gap-3">
              {/* A / B toggle */}
              <div className="flex gap-2">
                {(["a", "b"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => handleWorkoutType(t)}
                    className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                      workoutType === t
                        ? "bg-green-600 text-white"
                        : "bg-gray-700 text-gray-400"
                    }`}
                  >
                    {t === "a" ? "Repeaters" : "Max Hang"}
                  </button>
                ))}
              </div>

              {/* Hold picker */}
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
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
                    margin={{ top: 12, right: 8, bottom: 0, left: 32 }}
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
                      dot={(props) => <CustomDot {...props} />}
                      activeDot={{ r: 5 }}
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
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatPill({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-white font-bold text-lg tabular-nums">{value}</span>
      <span className="text-gray-500 text-xs">{label}</span>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2.5 h-2.5 rounded-sm ${color}`} />
      <span className="text-gray-400 text-xs">{label}</span>
    </div>
  );
}
