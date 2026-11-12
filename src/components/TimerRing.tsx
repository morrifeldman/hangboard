interface TimerRingProps {
  remaining: number;
  duration: number;
  label?: string;
  /** Text colour for the label, which sits large above the ring. */
  labelColor?: string;
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
  labelColor = "text-gray-200",
  sublabel,
  color = "stroke-accent-400",
  onClick,
  paused,
}: TimerRingProps) {
  const progress = duration > 0 ? Math.max(0, Math.min(1, remaining / duration)) : 0;
  const dashoffset = CIRCUMFERENCE * (1 - progress);

  return (
    <div className="flex flex-col items-center gap-2">
      {label && (
        <p className={`text-5xl font-bold leading-none ${labelColor}`} data-testid="timer-label">
          {label}
        </p>
      )}
      <div
        className={`w-64 h-64 relative ${onClick ? "cursor-pointer" : ""}`}
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
            strokeWidth="5"
            className="text-white/10"
          />
          {/* Progress arc */}
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            strokeWidth="5"
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
              <svg width="64" height="64" viewBox="0 0 24 24" fill="white" className="opacity-80">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
              <span className="text-lg font-medium text-gray-300 mt-1">Paused</span>
            </>
          ) : (
            <span className="font-num text-[112px] leading-none text-white">
              {Math.ceil(remaining)}
            </span>
          )}
        </div>
      </div>

      {sublabel && (
        <p className="text-gray-400 text-sm">{sublabel}</p>
      )}
    </div>
  );
}
