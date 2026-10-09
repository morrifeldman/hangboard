import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { PencilIcon } from "../icons";
import { buildLiftTrend, formatScheme } from "../../lib/lifts";
import type { SessionRecord } from "../../lib/history";
import { useWorkoutStore } from "../../store/useWorkoutStore";
import { ACCENT_HEX, AXIS_NUM_TICK, AXIS_TICK, toChartPoints } from "./chartTheme";
import { ChartTooltip } from "./ChartTooltip";
import { CustomDot } from "./CustomDot";
import { SectionHeading } from "./parts";

type Props = {
  sessions: SessionRecord[];
  /** Selected lift id from the URL; null shows the first lift in the library. */
  liftId: string | null;
  onSelectLift: (liftId: string) => void;
  onEditLift: (liftId: string) => void;
  onOpenSession: (sessionId: string) => void;
};

/** Top-set trend for one lift, plus the lift library that doubles as its picker. */
export function LiftsSection({ sessions, liftId, onSelectLift, onEditLift, onOpenSession }: Props) {
  const liftLibrary = useWorkoutStore((s) => s.lifts);
  // A deleted lift can linger in the URL; fall back rather than chart nothing.
  const selectedLift = liftLibrary.find((l) => l.id === liftId) ?? liftLibrary[0];
  const selectedLiftId = selectedLift?.id;
  const points = useMemo(
    () => toChartPoints(selectedLiftId ? buildLiftTrend(sessions, selectedLiftId) : []),
    [sessions, selectedLiftId],
  );

  if (!selectedLift) return null;

  return (
    <section className="flex flex-col gap-2.5">
      <SectionHeading>Lifts</SectionHeading>
      <div className="bg-gray-800 rounded-2xl px-4 py-3">
        {points.length < 2 ? (
          <div className="h-[160px] flex items-center justify-center">
            <p className="text-gray-600 text-sm">
              {points.length === 0
                ? `No ${selectedLift.name} sessions yet`
                : "Need at least 2 sessions to show trend"}
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={points} margin={{ top: 20, right: 8, bottom: 0, left: 0 }}>
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
              <ChartTooltip format={(v) => [v != null ? `${v} lb` : "—", "Top set"]} />
              <Line
                type="monotone"
                dataKey="weight"
                stroke={points[points.length - 1].weight >= points[0].weight ? ACCENT_HEX : "#6b7280"}
                strokeWidth={2}
                dot={(props) => <CustomDot {...props} onClick={onOpenSession} />}
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
                onClick={() => onSelectLift(lift.id)}
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
  );
}
