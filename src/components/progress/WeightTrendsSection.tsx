import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, ReferenceLine, ResponsiveContainer } from "recharts";
import { HOLDS } from "../../data/holds";
import { HOLDS_B } from "../../data/workout-b";
import { buildTrend } from "../../lib/progressData";
import { formatWeight } from "../../lib/format";
import type { SessionRecord } from "../../lib/history";
import { Pill, PillRow, Segmented } from "../ui";
import type { ProgressView } from "../ProgressScreen";
import { ACCENT_HEX, AXIS_NUM_TICK, AXIS_TICK, toChartPoints } from "./chartTheme";
import { ChartTooltip } from "./ChartTooltip";
import { CustomDot } from "./CustomDot";
import { SectionHeading } from "./parts";

const WORKOUTS: { value: ProgressView["workout"]; label: string }[] = [
  { value: "repeaters", label: "Repeaters" },
  { value: "max-hang", label: "Max Hang" },
];

type Props = {
  sessions: SessionRecord[];
  workout: ProgressView["workout"];
  hold: number;
  onViewChange: (patch: Partial<ProgressView>) => void;
  onOpenSession: (sessionId: string) => void;
};

/** Weight trend per hold, for either hangboard workout. */
export function WeightTrendsSection({ sessions, workout, hold, onViewChange, onOpenSession }: Props) {
  // The two workouts have different hold lists, so the picker starts over.
  const handleWorkoutType = (t: ProgressView["workout"]) => onViewChange({ workout: t, hold: 0 });

  // Extra holds from imported "a" sessions (e.g. "crimp") not in the standard HOLDS array
  const holds = useMemo(() => {
    if (workout !== "repeaters") return HOLDS_B.filter((h) => !h.skipProgression);
    const knownIds = new Set<string>(HOLDS.map((h) => h.id));
    const list: { id: string; name: string }[] = HOLDS.filter((h) => !h.skipProgression);
    for (const s of sessions) {
      if (s.workoutType !== "repeaters" && s.workoutType !== "beginner") continue;
      for (const h of s.holds) {
        if (!knownIds.has(h.holdId)) {
          list.push({ id: h.holdId, name: h.holdName });
          knownIds.add(h.holdId);
        }
      }
    }
    return list;
  }, [sessions, workout]);
  // A hand-edited or stale URL can point past the end of this workout's holds.
  const holdIndex = Math.min(Math.max(hold, 0), Math.max(holds.length - 1, 0));
  const selectedHoldId = holds[holdIndex]?.id;

  const chartPoints = useMemo(
    () => toChartPoints(selectedHoldId ? buildTrend(sessions, selectedHoldId, workout) : []),
    [sessions, selectedHoldId, workout],
  );
  const isTrendingUp =
    chartPoints.length >= 2 &&
    chartPoints[chartPoints.length - 1].weight >= chartPoints[0].weight;
  const lineColor = isTrendingUp ? ACCENT_HEX : "#6b7280";
  const workoutLabel = workout === "repeaters" ? "Repeaters" : "Max Hang";

  return (
    <section className="flex flex-col gap-2.5">
      <SectionHeading>Hangboard weights</SectionHeading>
      <div className="bg-gray-800 rounded-2xl px-4 py-3 flex flex-col gap-3">
        <Segmented
          label="Workout"
          options={WORKOUTS}
          value={workout}
          onChange={handleWorkoutType}
        />

        <PillRow className="-mx-4 px-4">
          {holds.map((h, i) => (
            <Pill key={h.id} size="sm" selected={holdIndex === i} onClick={() => onViewChange({ hold: i })}>
              {h.name}
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
                if (id) onOpenSession(id);
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
              <ChartTooltip format={(v) => [v != null ? formatWeight(v) : "—", "Weight"]} />
              <Line
                type="monotone"
                dataKey="weight"
                stroke={lineColor}
                strokeWidth={2}
                dot={(props) => <CustomDot {...props} onClick={onOpenSession} />}
                activeDot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
