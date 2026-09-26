import { RefreshCw, BarChart2, Trophy, CalendarDays, Hash } from "lucide-react";
import { BackChevronIcon } from "../icons";

type Props = {
  onRefresh: () => void;
  isRefreshing: boolean;
  onBack: () => void;
  showCounts: boolean;
  onToggleCounts: () => void;
  showSendsOnly: boolean;
  onToggleSendsOnly: () => void;
  showSessionCounts: boolean;
  onToggleSessionCounts: () => void;
};

export function PyramidHeader({ onRefresh, isRefreshing, onBack, showCounts, onToggleCounts, showSendsOnly, onToggleSendsOnly, showSessionCounts, onToggleSessionCounts }: Props) {
  return (
    <div className="bg-gray-800 px-4 py-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors p-2 -ml-2 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400" aria-label="Back">
            <BackChevronIcon />
          </button>
          <h1 className="text-white text-xl font-bold">Pyramid</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggles — grouped in one recessed well (like a B/I/U toolbar
              group) so "options that hold a state" read distinctly from the
              solid action buttons. Each segment lights up in accent when on. */}
          <div className="flex items-center gap-0.5 rounded-xl bg-gray-900 p-0.5 ring-1 ring-inset ring-white/5">
            <button
              onClick={onToggleSendsOnly}
              className={`px-2.5 py-2 rounded-lg flex items-center text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 ${
                showSendsOnly
                  ? "bg-accent-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-700/50"
              }`}
              title={showSendsOnly ? "Sends only — tap to include attempts" : "Showing all — tap to filter to sends only"}
              aria-pressed={showSendsOnly}
              aria-label="Toggle sends only"
            >
              <Trophy size={16} />
            </button>
            <button
              onClick={onToggleCounts}
              className={`px-2.5 py-2 rounded-lg flex items-center text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 ${
                showCounts
                  ? "bg-accent-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-700/50"
              }`}
              title="Toggle per-grade counts and cumulative bars"
              aria-pressed={showCounts}
              aria-label="Toggle counts"
            >
              <BarChart2 size={16} />
            </button>
            <button
              onClick={onToggleSessionCounts}
              className={`px-2.5 py-2 rounded-lg flex items-center text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 ${
                showSessionCounts
                  ? "bg-accent-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-700/50"
              }`}
              title={
                showSessionCounts
                  ? "Tile numbers show sessions — tap to count climbs"
                  : "Tile numbers show climbs — tap to count sessions"
              }
              aria-pressed={showSessionCounts}
              aria-label="Toggle session vs climb counts"
            >
              {showSessionCounts ? <CalendarDays size={16} /> : <Hash size={16} />}
            </button>
          </div>

          {/* Divider separates stateful toggles from imperative actions. */}
          <div className="w-px h-7 bg-gray-700" />

          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="bg-gray-700 text-gray-200 px-2.5 py-2 rounded-lg flex items-center text-sm hover:bg-gray-600 hover:text-white transition-colors disabled:text-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
            title="Refresh from Mountain Project"
            aria-label="Refresh from Mountain Project"
          >
            <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </div>
    </div>
  );
}
