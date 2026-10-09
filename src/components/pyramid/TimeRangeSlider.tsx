import type { ClimbRecord } from "../../lib/climbs";
import { getDateRangeInfo } from "../../lib/climbUtils";
import { formatDateKey, toLocalDateString } from "../../lib/dates";
import type { ViewKey } from "../../constants/climbGrades";

type Props = {
  climbs: ClimbRecord[];
  currentView: ViewKey;
  timeRange: [number, number];
  setTimeRange: (v: [number, number]) => void;
};

export function TimeRangeSlider({ climbs, currentView, timeRange, setTimeRange }: Props) {
  if (climbs.length === 0) return null;

  const dateInfo = getDateRangeInfo(climbs, currentView, timeRange);

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
        <h2 className="text-sm font-semibold text-gray-300">Time range</h2>
        <button
          onClick={() => setTimeRange([0, 100])}
          className="-my-2 -mr-2 px-2 py-2 rounded-lg text-sm font-semibold text-accent-400 hover:text-accent-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
        >
          Reset
        </button>
      </div>

      <div className="relative h-6 mx-2">
        <div className="absolute top-2.5 w-full h-1 bg-gray-700 rounded-full" />
        <div
          className="absolute top-2.5 h-1 bg-accent-500 rounded-full"
          style={{ left: `${timeRange[0]}%`, width: `${timeRange[1] - timeRange[0]}%` }}
        />
        <div
          className="absolute top-0.5 w-5 h-5 bg-white rounded-full cursor-pointer border-2 border-accent-500 shadow-md before:absolute before:-inset-3 before:content-['']"
          style={{ left: `calc(${timeRange[0]}% - 10px)` }}
          onMouseDown={handleDragStart(true)}
          onTouchStart={handleDragStart(true)}
        />
        <div
          className="absolute top-0.5 w-5 h-5 bg-white rounded-full cursor-pointer border-2 border-accent-500 shadow-md before:absolute before:-inset-3 before:content-['']"
          style={{ left: `calc(${timeRange[1]}% - 10px)` }}
          onMouseDown={handleDragStart(false)}
          onTouchStart={handleDragStart(false)}
        />
      </div>

      {dateInfo && (
        <div className="flex justify-between text-xs text-gray-500 mt-2">
          <span>{formatDateKey(toLocalDateString(dateInfo.startDate))}</span>
          <span className="font-medium">
            {dateInfo.isFullRange
              ? "All time"
              : `${Math.round(timeRange[1] - timeRange[0])}% of history`}
          </span>
          <span>{formatDateKey(toLocalDateString(dateInfo.endDate))}</span>
        </div>
      )}
    </div>
  );
}
