import { getStyleColor } from "../../../lib/climbUtils";
import type { ClimbRecord } from "../../../lib/climbs";

type Props = {
  climb: ClimbRecord | null;
  onClose: () => void;
  onEdit: (c: ClimbRecord) => void;
  onDelete: (id: string) => void;
};

export function ClimbDetailModal({ climb, onClose, onEdit, onDelete }: Props) {
  if (!climb) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-xl max-w-lg w-full">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-xl font-bold text-white">{climb.route}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-lg font-semibold text-green-400">{climb.grade}</span>
                <div className={`w-3 h-3 rounded ${getStyleColor(climb.style)}`} />
                <span className="text-sm text-gray-400 capitalize">{climb.style}</span>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-white text-2xl">
              &times;
            </button>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Setting</label>
                <p className="text-gray-200 capitalize">{climb.setting}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Type</label>
                <p className="text-gray-200 capitalize">{climb.type}</p>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-500">Location</label>
              <p className="text-gray-200">{climb.location || "Not specified"}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Date</label>
                <p className="text-gray-200">{new Date(climb.date).toLocaleDateString()}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Attempts</label>
                <p className="text-gray-200">
                  {climb.style === "attempt"
                    ? `Failed after ${climb.attempts} attempt${climb.attempts > 1 ? "s" : ""}`
                    : climb.attempts === 1 && (climb.style === "onsight" || climb.style === "flash")
                      ? `${climb.style === "onsight" ? "Onsight" : "Flash"} (1st try)`
                      : `${climb.attempts} attempt${climb.attempts > 1 ? "s" : ""}`}
                </p>
              </div>
            </div>

            {climb.notes && (
              <div>
                <label className="text-sm font-medium text-gray-500">Notes</label>
                <p className="text-gray-200 whitespace-pre-wrap">{climb.notes}</p>
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-between">
            <button
              onClick={() => onDelete(climb.id)}
              className="bg-red-600 text-white px-4 py-2 rounded-xl hover:bg-red-700 transition-colors"
            >
              Delete
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => onEdit(climb)}
                className="bg-green-600 text-white px-4 py-2 rounded-xl hover:bg-green-700 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={onClose}
                className="bg-gray-700 text-gray-300 px-4 py-2 rounded-xl hover:bg-gray-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
