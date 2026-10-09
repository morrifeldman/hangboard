type RangeSliderProps = {
  max: number;
  start: number;
  end: number;
  startLabel: string;
  endLabel: string;
  onChange: (start: number, end: number) => void;
};

/** Dual-handle slider: two overlaid range inputs that can't cross. */
export function RangeSlider({ max, start, end, startLabel, endLabel, onChange }: RangeSliderProps) {
  const pct = (v: number) => (max === 0 ? 0 : (v / max) * 100);
  const thumbCls =
    "absolute inset-x-0 top-0 w-full h-10 appearance-none bg-transparent pointer-events-none " +
    "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none " +
    "[&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full " +
    "[&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-accent-500 " +
    "[&::-webkit-slider-thumb]:cursor-pointer focus:outline-none focus-visible:[&::-webkit-slider-thumb]:ring-2 focus-visible:[&::-webkit-slider-thumb]:ring-accent-400 " +
    "[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 " +
    "[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 " +
    "[&::-moz-range-thumb]:border-accent-500 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-solid";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs text-gray-400 px-0.5">
        <span>{startLabel}</span>
        <span>{endLabel}</span>
      </div>
      <div className="relative h-10">
        <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1 bg-gray-700 rounded" />
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1 bg-accent-500 rounded"
          style={{ left: `${pct(start)}%`, right: `${100 - pct(end)}%` }}
        />
        <input
          type="range" min={0} max={max} step={1} value={start}
          aria-label="Range start"
          onChange={(e) => onChange(Math.min(Number(e.target.value), end), end)}
          className={thumbCls}
        />
        <input
          type="range" min={0} max={max} step={1} value={end}
          aria-label="Range end"
          onChange={(e) => onChange(start, Math.max(Number(e.target.value), start))}
          className={thumbCls}
        />
      </div>
    </div>
  );
}
