import { formatWeight } from "../lib/format";

interface WeightAdjusterProps {
  value: number;
  onDelta: (delta: number) => void;
  label?: string;
  disabled?: boolean;
  formatValue?: (n: number) => string;
}

export function WeightAdjuster({ value, onDelta, label, disabled = false, formatValue = formatWeight }: WeightAdjusterProps) {
  const btnClass =
    "min-h-[44px] min-w-[52px] px-3 rounded-lg bg-gray-700 active:bg-gray-600 text-white font-num text-base select-none disabled:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400";

  return (
    <div className="flex flex-col items-center gap-2">
      {label && <span className="text-gray-400 text-sm">{label}</span>}
      <div className="flex items-center gap-3">
        <button className={btnClass} onClick={() => onDelta(-2.5)} disabled={disabled}>
          −2.5
        </button>
        <span className="min-w-[88px] text-center text-white font-num text-3xl select-none">
          {formatValue(value)}
        </span>
        <button className={btnClass} onClick={() => onDelta(2.5)} disabled={disabled}>
          +2.5
        </button>
      </div>
    </div>
  );
}
