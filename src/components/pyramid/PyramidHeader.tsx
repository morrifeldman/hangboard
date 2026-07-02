import { Upload, RefreshCw, Layers, BarChart2, Trophy, CalendarDays, Hash, ChevronRight } from "lucide-react";
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
          {/* Navigation to the scrolling-pyramids screen. Outline pill + a
              forward chevron reads as "drill into another view" — deliberately
              unlike the indigo-fill toggles, which hold an on/off state. */}
          <button
            onClick={onShowScrolling}
            className="ml-1 flex items-center gap-0.5 rounded-xl border border-gray-600 bg-gray-800 pl-2.5 pr-1.5 py-1.5 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
            title="Scrolling Pyramids"
            aria-label="Scrolling Pyramids"
          >
            <Layers size={16} />
            <ChevronRight size={14} className="opacity-60" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggles — grouped in one recessed well (like a B/I/U toolbar
              group) so "options that hold a state" read distinctly from the
              solid action buttons. Each segment lights up indigo when on. */}
          <div className="flex items-center gap-0.5 rounded-xl bg-gray-900 p-0.5 ring-1 ring-inset ring-white/5">
            <button
              onClick={onToggleSendsOnly}
              className={`px-2.5 py-1.5 rounded-lg flex items-center text-sm transition-colors ${
                showSendsOnly
                  ? "bg-indigo-600 text-white"
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
              className={`px-2.5 py-1.5 rounded-lg flex items-center text-sm transition-colors ${
                showCounts
                  ? "bg-indigo-600 text-white"
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
              className={`px-2.5 py-1.5 rounded-lg flex items-center text-sm transition-colors ${
                showSessionCounts
                  ? "bg-indigo-600 text-white"
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
