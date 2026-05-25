import { Upload, RefreshCw, Layers, BarChart2, Trophy, CalendarDays, Repeat } from "lucide-react";
import { BackChevronIcon, PyramidIcon } from "../icons";

type Props = {
  onImport: () => void;
  onRefresh: () => void;
  canRefresh: boolean;
  isRefreshing: boolean;
  onBack: () => void;
  onShowScrolling: () => void;
  showCounts: boolean;
  onToggleCounts: () => void;
  showSendsOnly: boolean;
  onToggleSendsOnly: () => void;
  showSessionCounts: boolean;
  onToggleSessionCounts: () => void;
};

export function PyramidHeader({ onImport, onRefresh, canRefresh, isRefreshing, onBack, onShowScrolling, showCounts, onToggleCounts, showSendsOnly, onToggleSendsOnly, showSessionCounts, onToggleSessionCounts }: Props) {
  return (
    <div className="bg-gray-800 px-4 py-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors p-1 -ml-1" aria-label="Back">
            <BackChevronIcon />
          </button>
          <PyramidIcon className="text-white" aria-label="Climbing Pyramid" />
          <button
            onClick={onShowScrolling}
            className="ml-1 bg-indigo-600 text-white px-2.5 py-1.5 rounded-xl flex items-center text-sm hover:bg-indigo-700 transition-colors"
            title="Scrolling Pyramids"
            aria-label="Scrolling Pyramids"
          >
            <Layers size={16} />
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onToggleSendsOnly}
            className={`px-2.5 py-1.5 rounded-xl flex items-center text-sm transition-colors ${
              showSendsOnly
                ? "bg-indigo-600 text-white hover:bg-indigo-700"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white"
            }`}
            title={showSendsOnly ? "Sends only — tap to include attempts" : "Showing all — tap to filter to sends only"}
            aria-pressed={showSendsOnly}
            aria-label="Toggle sends only"
          >
            <Trophy size={16} />
          </button>
          <button
            onClick={onToggleCounts}
            className={`px-2.5 py-1.5 rounded-xl flex items-center text-sm transition-colors ${
              showCounts
                ? "bg-indigo-600 text-white hover:bg-indigo-700"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white"
            }`}
            title="Toggle per-grade counts and cumulative bars"
            aria-pressed={showCounts}
            aria-label="Toggle counts"
          >
            <BarChart2 size={16} />
          </button>
          <button
            onClick={onToggleSessionCounts}
            className={`px-2.5 py-1.5 rounded-xl flex items-center text-sm transition-colors ${
              showSessionCounts
                ? "bg-indigo-600 text-white hover:bg-indigo-700"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white"
            }`}
            title={
              showSessionCounts
                ? "Tile numbers show sessions — tap to show climb counts"
                : "Tile numbers show climbs — tap to show session counts"
            }
            aria-pressed={showSessionCounts}
            aria-label="Toggle session vs climb counts"
          >
            {showSessionCounts ? <CalendarDays size={16} /> : <Repeat size={16} />}
          </button>
          <button
            onClick={onImport}
            className="bg-green-600 text-white px-2.5 py-1.5 rounded-xl flex items-center text-sm hover:bg-green-700 transition-colors"
            title="Import from CSV"
            aria-label="Import"
          >
            <Upload size={16} />
          </button>
          {canRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="bg-orange-600 text-white px-2.5 py-1.5 rounded-xl flex items-center text-sm hover:bg-orange-700 transition-colors disabled:opacity-70"
              title="Refresh from Mountain Project"
              aria-label="Refresh from Mountain Project"
            >
              <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
