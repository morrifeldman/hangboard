import type { ClimbRecord } from "../../lib/climbs";
import { getDateRangeInfo } from "../../lib/climbUtils";

type Props = {
  climbs: ClimbRecord[];
  timeRange: [number, number];
  setTimeRange: (v: [number, number]) => void;
};

export function TimeRangeSlider({ climbs, timeRange, setTimeRange }: Props) {
  if (climbs.length === 0) return null;

  const dateInfo = getDateRangeInfo(climbs, timeRange);

  const handleDragStart = (isStart: boolean) => (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    const slider = (e.currentTarget as HTMLDivElement).parentElement!;
    const rect = slider.getBoundingClientRect();

    const getPercent = (clientX: number) =>
      Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));

    const handleMove = (ev: MouseEvent | TouchEvent) => {
      const clientX = "touches" in ev ? ev.touches[0].clientX : ev.clientX;
      const percent = getPercent(clientX);
      if (isStart && percent <= timeRange[1]) {
        setTimeRange([Math.round(percent), timeRange[1]]);
      } else if (!isStart && percent >= timeRange[0]) {
        setTimeRange([timeRange[0], Math.round(percent)]);
      }
    };

    const handleEnd = () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleEnd);
      document.removeEventListener("touchmove", handleMove);
      document.removeEventListener("touchend", handleEnd);
    };

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleEnd);
    document.addEventListener("touchmove", handleMove, { passive: false });
    document.addEventListener("touchend", handleEnd);
  };

  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium text-gray-400">Time Range</h3>
        <button
          onClick={() => setTimeRange([0, 100])}
          className="text-xs text-green-400 hover:text-green-300"
        >
          Reset
        </button>
      </div>

      <div className="relative h-6">
        <div className="absolute top-2 w-full h-2 bg-gray-700 rounded-lg" />
        <div
          className="absolute top-2 h-2 bg-green-600 rounded-lg"
          style={{ left: `${timeRange[0]}%`, width: `${timeRange[1] - timeRange[0]}%` }}
        />
        <div
          className="absolute top-1 w-4 h-4 bg-green-500 rounded-full cursor-pointer border-2 border-gray-900 shadow-md hover:scale-110 transition-transform"
          style={{ left: `calc(${timeRange[0]}% - 8px)` }}
          onMouseDown={handleDragStart(true)}
          onTouchStart={handleDragStart(true)}
        />
        <div
          className="absolute top-1 w-4 h-4 bg-green-500 rounded-full cursor-pointer border-2 border-gray-900 shadow-md hover:scale-110 transition-transform"
          style={{ left: `calc(${timeRange[1]}% - 8px)` }}
          onMouseDown={handleDragStart(false)}
          onTouchStart={handleDragStart(false)}
        />
      </div>

      {dateInfo && (
        <div className="flex justify-between text-xs text-gray-500 mt-2">
          <span>{dateInfo.startDate.toLocaleDateString()}</span>
          <span className="font-medium">
            {dateInfo.isFullRange
              ? "All Time"
              : `${Math.round(timeRange[1] - timeRange[0])}% of history`}
          </span>
          <span>{dateInfo.endDate.toLocaleDateString()}</span>
        </div>
      )}
    </div>
  );
}
