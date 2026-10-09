import type { TrendPoint } from "../../lib/progressData";

// Matches getStyleColor, so a flash is the same yellow in the pyramid and the chart.
export const STYLE_HEX = { onsight: "#22c55e", flash: "#eab308", redpoint: "#ef4444" } as const;
export const ACCENT_HEX = "#22c55e";

export const AXIS_TICK = { fill: "#6b7280", fontSize: 10 };
export const AXIS_NUM_TICK = { ...AXIS_TICK, fontSize: 12, className: "font-num" };

export type ChartPoint = {
  weight: number;
  label: string;
  bailed: boolean;
  isPR: boolean;
  setFailed: boolean;
  isBeginner: boolean;
  sessionId: string;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function toChartPoints(trend: TrendPoint[]): ChartPoint[] {
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
