import { formatWeight } from "../lib/format";

export const WEIGHT_STEP = 2.5;

interface WeightStepperProps {
  value: number;
  onChange: (value: number) => void;
  label: string;
  struck?: boolean;
  formatValue?: (n: number) => string;
}

// Rounding keeps repeated 2.5 steps from drifting into values like 12.499999.
const step = (value: number, delta: number) => Math.round((value + delta) * 10) / 10;

export function WeightStepper({ value, onChange, label, struck = false, formatValue = formatWeight }: WeightStepperProps) {
  const btnClass =
    "w-6 h-7 flex-shrink-0 rounded-md bg-gray-700 active:bg-gray-600 text-gray-200 text-base leading-none select-none flex items-center justify-center";

  return (
    <div className="flex items-center gap-0.5 flex-shrink-0" role="group" aria-label={label}>
      <button type="button" className={btnClass} onClick={() => onChange(step(value, -WEIGHT_STEP))} aria-label={`${label} −${WEIGHT_STEP}`}>
        −
      </button>
      <span
        className={`min-w-[2.5rem] text-center text-sm font-mono select-none ${struck ? "text-red-400/70 line-through" : "text-white"}`}
        aria-live="polite"
      >
        {formatValue(value)}
      </span>
      <button type="button" className={btnClass} onClick={() => onChange(step(value, WEIGHT_STEP))} aria-label={`${label} +${WEIGHT_STEP}`}>
        +
      </button>
    </div>
  );
}
