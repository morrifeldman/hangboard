import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { buildGradeTrend, gradeLabel } from "../../lib/gradeTrends";
import type { Granularity, GradeTrendPoint } from "../../lib/gradeTrends";
import type { ClimbRecord } from "../../lib/climbs";
import { Segmented } from "../ui";
import { AXIS_NUM_TICK, AXIS_TICK, STYLE_HEX } from "./chartTheme";
import { ChartTooltip } from "./ChartTooltip";
import { LegendItem, SectionHeading } from "./parts";
import { RangeSlider } from "./RangeSlider";

const GRANULARITIES: { value: Granularity; label: string }[] = [
  { value: "months", label: "Months" },
  { value: "seasons", label: "Seasons" },
  { value: "years", label: "Years" },
];

function rangeTicks(min: number, max: number): number[] {
  const out: number[] = [];
  for (let i = min; i <= max; i++) out.push(i);
  return out;
}

type Props = {
  climbs: ClimbRecord[];
  granularity: Granularity;
  onGranularityChange: (g: Granularity) => void;
};

/** Outdoor sport grade trend, with a Months / Seasons / Years grouping. */
export function GradeTrendSection({ climbs, granularity, onGranularityChange }: Props) {
  const trend = useMemo(() => buildGradeTrend(climbs, granularity), [climbs, granularity]);

  return (
    <section className="flex flex-col gap-2.5">
      <SectionHeading>Route grades over time</SectionHeading>
      <div className="bg-gray-800 rounded-2xl px-4 py-3 flex flex-col gap-4">
        <Segmented
          label="Group by"
          options={GRANULARITIES}
          value={granularity}
          onChange={onGranularityChange}
        />

        {trend.length === 0 ? (
          <div className="h-[180px] flex items-center justify-center">
            <p className="text-gray-600 text-sm">No outdoor sport climbs yet</p>
          </div>
        ) : (
          // The range starts at the full span whenever the bucket list changes
          // (first load, granularity switch), so a new length remounts the chart.
          <GradeChart key={trend.length} trend={trend} />
        )}
      </div>
    </section>
  );
}

function GradeChart({ trend }: { trend: GradeTrendPoint[] }) {
  const [range, setRange] = useState<[number, number]>([0, trend.length - 1]);
  const start = Math.min(range[0], range[1]);
  const end = Math.max(range[0], range[1]);

  const visible = useMemo(() => trend.slice(start, end + 1), [trend, start, end]);

  const yDomain = useMemo<[number, number] | undefined>(() => {
    const vals: number[] = [];
    for (const p of visible) {
      if (p.onsight !== null) vals.push(p.onsight);
      if (p.flash !== null) vals.push(p.flash);
      if (p.redpoint !== null) vals.push(p.redpoint);
    }
    if (vals.length === 0) return undefined;
    return [Math.max(0, Math.min(...vals) - 1), Math.min(15, Math.max(...vals) + 1)];
  }, [visible]);

  return (
    <>
      <RangeSlider
        max={trend.length - 1}
        start={start}
        end={end}
        startLabel={trend[start]?.label ?? ""}
        endLabel={trend[end]?.label ?? ""}
        onChange={(s, e) => setRange([s, e])}
      />

      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={visible} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <XAxis
            dataKey="label"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={yDomain ?? [0, 15]}
            type="number"
            ticks={yDomain ? rangeTicks(yDomain[0], yDomain[1]) : undefined}
            tick={AXIS_NUM_TICK}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => gradeLabel(v)}
            width={40}
          />
          <ChartTooltip format={(v, name) => [v == null ? "—" : gradeLabel(v), name ?? ""]} />
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
  );
}
