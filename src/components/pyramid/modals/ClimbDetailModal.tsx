import { getStyleColor } from "../../../lib/climbUtils";
import type { ClimbRecord } from "../../../lib/climbs";

const STYLE_COLORS: Record<string, string> = {
  onsight: "bg-green-500/20 text-green-400",
  flash:   "bg-blue-500/20 text-blue-400",
  redpoint:"bg-red-500/20 text-red-400",
  attempt: "bg-gray-700 text-gray-500",
};

type Props = {
  climb: ClimbRecord | null;
  allClimbs: ClimbRecord[];
  onClose: () => void;
  onEdit: (c: ClimbRecord) => void;
  onDelete: (id: string) => void;
};

export function ClimbDetailModal({ climb, allClimbs, onClose, onEdit, onDelete }: Props) {
  if (!climb) return null;

  const routeHistory = allClimbs
    .filter((c) => c.route === climb.route)
    .sort((a, b) => b.date.localeCompare(a.date));

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
                <label className="text-sm font-medium text-gray-500">Climbs</label>
                <p className="text-gray-200">
                  {climb.style === "attempt"
                    ? `${climb.climbs} attempt${climb.climbs !== 1 ? "s" : ""}`
                    : climb.climbs === 1
                      ? `${climb.style === "onsight" ? "Onsight" : climb.style === "flash" ? "Flash" : "Send"}`
                      : `Sent after ${climb.climbs - 1} attempt${climb.climbs - 1 !== 1 ? "s" : ""}`}
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

          {routeHistory.length > 1 && (
            <div className="mt-4 border-t border-gray-700 pt-4">
              <p className="text-sm font-medium text-gray-500 mb-2">Sessions ({routeHistory.length})</p>
              <div className="flex flex-col gap-2">
                {routeHistory.map((c) => {
                  const falls = c.style === "redpoint" ? c.climbs - 1 : 0;
                  const styleLabel =
                    c.style === "attempt"   ? (c.climbs > 1 ? `${c.climbs} attempts` : "attempt") :
                    c.style === "redpoint"  ? (falls > 0 ? `${falls} attempt${falls !== 1 ? "s" : ""} · send` : "redpoint") :
                    c.style;
                  return (
                    <div key={c.id} className={`flex items-center gap-2 rounded px-2 py-1 ${c.id === climb.id ? "bg-gray-700/60" : ""}`}>
                      <span className="text-gray-300 text-xs flex-1">
                        {new Date(`${c.date}T12:00:00`).toLocaleDateString("en-US", {
                          month: "short", day: "numeric", year: "numeric",
                        })}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${STYLE_COLORS[c.style] ?? STYLE_COLORS.attempt}`}>
                        {styleLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
