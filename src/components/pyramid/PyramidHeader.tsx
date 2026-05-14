import { Plus, Upload, RefreshCw, ArrowLeft, Layers, BarChart2 } from "lucide-react";

type Props = {
  onAddClimb: () => void;
  onImport: () => void;
  onRefresh: () => void;
  canRefresh: boolean;
  isRefreshing: boolean;
  onBack: () => void;
  onShowScrolling: () => void;
  showCounts: boolean;
  onToggleCounts: () => void;
};

export function PyramidHeader({ onAddClimb, onImport, onRefresh, canRefresh, isRefreshing, onBack, onShowScrolling, showCounts, onToggleCounts }: Props) {
  return (
    <div className="bg-gray-800 px-4 py-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors p-1">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl font-bold text-white">Climbing Pyramid</h1>
        </div>
        <div className="flex gap-2">
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
            onClick={onShowScrolling}
            className="bg-indigo-600 text-white px-3 py-1.5 rounded-xl flex items-center gap-1 text-sm hover:bg-indigo-700 transition-colors"
            title="Scrolling Pyramids"
          >
            <Layers size={16} />
            Scrolling
          </button>
          <button
            onClick={onAddClimb}
            className="bg-green-600 text-white px-3 py-1.5 rounded-xl flex items-center gap-1 text-sm hover:bg-green-700 transition-colors"
          >
            <Plus size={16} />
            Add
          </button>
          {canRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="bg-orange-600 text-white px-3 py-1.5 rounded-xl flex items-center gap-1 text-sm hover:bg-orange-700 transition-colors disabled:opacity-70"
              title="Refresh from Mountain Project"
            >
              <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
            </button>
          )}
          <button
            onClick={onImport}
            className="bg-green-600 text-white px-3 py-1.5 rounded-xl flex items-center gap-1 text-sm hover:bg-green-700 transition-colors"
          >
            <Upload size={16} />
            Import
          </button>
        </div>
      </div>
    </div>
  );
}
