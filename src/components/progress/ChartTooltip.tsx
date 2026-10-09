import { Tooltip } from "recharts";

const TOOLTIP_STYLE = { background: "#111827", border: "1px solid #374151", borderRadius: 8, fontSize: 12 };
const LABEL_STYLE = { color: "#9ca3af" };

/**
 * The dark Recharts tooltip all three charts share. `format` turns a value
 * into the tooltip row: `[text, name]`; `name` is undefined-able under strict TS.
 */
export function ChartTooltip({
  format,
}: {
  format: (v: number | undefined, name: string | undefined) => [string, string];
}) {
  return <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={LABEL_STYLE} formatter={format} />;
}
