interface TimerRingProps {
  remaining: number;
  duration: number;
  label?: string;
  sublabel?: string;
  color?: string;
  onClick?: () => void;
  paused?: boolean;
}

const RADIUS = 45;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function TimerRing({
  remaining,
  duration,
  label,
  sublabel,
  color = "stroke-indigo-400",
  onClick,
  paused,
}: TimerRingProps) {
  const progress = duration > 0 ? Math.max(0, Math.min(1, remaining / duration)) : 0;
  const dashoffset = CIRCUMFERENCE * (1 - progress);

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`w-44 h-44 relative ${onClick ? "cursor-pointer" : ""}`}
        onClick={onClick}
      >
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full -rotate-90"
          aria-label={`${Math.ceil(remaining)} seconds remaining`}
        >
          {/* Background track */}
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            className="text-gray-700"
          />
          {/* Progress arc */}
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashoffset}
            className={color}
            style={{ transition: "stroke-dashoffset 0.1s linear" }}
          />
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {paused ? (
            <>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="white" className="opacity-80">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
              <span className="text-sm font-medium text-gray-400 mt-1">PAUSED</span>
            </>
          ) : (
            <>
              <span className="text-5xl font-bold tabular-nums text-white">
                {Math.ceil(remaining)}
              </span>
              {label && (
                <span className="text-sm font-medium text-gray-400 mt-1">{label}</span>
              )}
            </>
          )}
        </div>
      </div>

      {sublabel && (
        <p className="text-gray-400 text-sm">{sublabel}</p>
      )}
    </div>
  );
}
