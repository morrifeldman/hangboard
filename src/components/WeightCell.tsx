import { formatWeight } from "../lib/format";
import { WEIGHT_STEP, step as stepBy } from "./WeightStepper";

interface WeightCellProps {
  value: number;
  onChange: (value: number) => void;
  label: string;
  completed: boolean;
  onToggleCompleted?: () => void;
  pr?: boolean;
  open: boolean;
  onOpen: () => void;
  /** The last column anchors its editor to the right so it can't spill off the card. */
  align?: "center" | "end";
  step?: number;
  /** The −/+ buttons won't go below this. */
  min?: number;
  formatValue?: (n: number) => string;
}

/**
 * A weight in the session table. It stays a bare number so the table reads at a
 * glance, and only grows −/+ buttons around itself while you're changing it.
 */
export function WeightCell({
  value, onChange, label, completed, onToggleCompleted, pr = false, open, onOpen, align = "center",
  step = WEIGHT_STEP, min = -Infinity, formatValue = formatWeight,
}: WeightCellProps) {
  const tone = !completed ? "text-red-400/70 line-through" : pr ? "text-amber-300" : "text-white";
  const btnClass =
    "w-10 h-9 flex-shrink-0 rounded-lg bg-gray-600 active:bg-gray-500 text-gray-100 disabled:bg-gray-700 disabled:text-gray-500 text-lg leading-none select-none flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400";

  return (
    <div className="relative flex justify-center" data-weight-cell>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${label}, ${formatValue(value)}${completed ? "" : ", failed"}`}
        aria-expanded={open}
        className={`h-9 w-full rounded-lg font-num text-base active:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 ${tone} ${open ? "invisible" : ""}`}
      >
        {formatValue(value)}
      </button>
      {open && (
        <div
          role="group"
          aria-label={label}
          className={`absolute -top-1 z-20 flex flex-col items-stretch gap-1 rounded-xl bg-gray-700 p-1 shadow-lg shadow-black/50 ring-1 ring-gray-600 ${
            align === "end" ? "-right-1" : "left-1/2 -translate-x-1/2"
          }`}
        >
          <div className="flex items-center gap-1">
            <button type="button" className={btnClass} onClick={() => onChange(Math.max(min, stepBy(value, -step)))} disabled={value - step < min} aria-label={`${label} −${step}`}>
              −
            </button>
            <span className={`min-w-[2.75rem] text-center font-num text-lg select-none ${tone}`} aria-live="polite">
              {formatValue(value)}
            </span>
            <button type="button" className={btnClass} onClick={() => onChange(stepBy(value, step))} aria-label={`${label} +${step}`}>
              +
            </button>
          </div>
          {onToggleCompleted && (
            <button
              type="button"
              onClick={onToggleCompleted}
              className={`h-8 rounded-lg text-xs font-semibold ${
                completed ? "bg-accent-500/15 text-accent-300" : "bg-red-400/15 text-red-300"
              }`}
            >
              {completed ? "✓ Completed" : "✕ Failed"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
