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
    "min-h-[48px] min-w-[48px] px-3 rounded-lg bg-gray-700 active:bg-gray-600 text-white font-semibold text-sm disabled:opacity-40 select-none";

  return (
    <div className="flex flex-col items-center gap-2">
      {label && <span className="text-gray-400 text-sm">{label}</span>}
      <div className="flex items-center gap-2">
        <button className={btnClass} onClick={() => onDelta(-5)} disabled={disabled}>
          −5
        </button>
        <button className={btnClass} onClick={() => onDelta(-2.5)} disabled={disabled}>
          −2.5
        </button>
        <span className="min-w-[80px] text-center text-white font-bold text-lg select-none">
          {formatValue(value)}
        </span>
        <button className={btnClass} onClick={() => onDelta(2.5)} disabled={disabled}>
          +2.5
        </button>
        <button className={btnClass} onClick={() => onDelta(5)} disabled={disabled}>
          +5
        </button>
      </div>
    </div>
  );
}
