import { ACCENT_HEX } from "./chartTheme";
import type { ChartPoint } from "./chartTheme";

type DotProps = {
  cx?: number;
  cy?: number;
  payload?: ChartPoint;
  onClick?: (sessionId: string) => void;
};

/** A weight-trend dot: PR label, hollow when bailed, diamond for beginner sessions. */
export function CustomDot({ cx, cy, payload, onClick }: DotProps) {
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
