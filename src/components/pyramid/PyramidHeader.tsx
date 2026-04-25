import { Plus, Upload, RefreshCw, ArrowLeft } from "lucide-react";

type Props = {
  onAddClimb: () => void;
  onImport: () => void;
  onRefresh: () => void;
  canRefresh: boolean;
  isRefreshing: boolean;
  onBack: () => void;
};

export function PyramidHeader({ onAddClimb, onImport, onRefresh, canRefresh, isRefreshing, onBack }: Props) {
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
