import { SPORT_GRADES, BOULDER_GRADES } from "../../../constants/climbGrades";
import type { ClimbRecord } from "../../../lib/climbs";

type Props = {
  climb: ClimbRecord | null;
  onClose: () => void;
  onSave: () => void;
  setEditingClimb: (c: ClimbRecord) => void;
};

const INPUT = "w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 placeholder-gray-500";

export function EditClimbModal({ climb, onClose, onSave, setEditingClimb }: Props) {
  if (!climb) return null;

  const handleSubmit = () => {
    if (climb.route && climb.grade) onSave();
  };

  const grades = climb.type === "boulder" ? BOULDER_GRADES : SPORT_GRADES;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-white">Edit Climb</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-white text-2xl">
              &times;
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Route Name</label>
              <input
                type="text"
                value={climb.route}
                onChange={(e) => setEditingClimb({ ...climb, route: e.target.value })}
                className={INPUT}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Type</label>
                <select
                  value={climb.type}
                  onChange={(e) =>
                    setEditingClimb({ ...climb, type: e.target.value as "sport" | "boulder" })
                  }
                  className={INPUT}
                >
                  <option value="sport">Sport/Trad</option>
                  <option value="boulder">Boulder</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Setting</label>
                <select
                  value={climb.setting}
                  onChange={(e) =>
                    setEditingClimb({ ...climb, setting: e.target.value as "outdoor" | "indoor" })
                  }
                  className={INPUT}
                >
                  <option value="outdoor">Outdoor</option>
                  <option value="indoor">Indoor</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Grade</label>
              <select
                value={climb.grade}
                onChange={(e) => setEditingClimb({ ...climb, grade: e.target.value })}
                className={INPUT}
              >
                <option value="">Select grade</option>
                {grades.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Location</label>
              <input
                type="text"
                value={climb.location}
                onChange={(e) => setEditingClimb({ ...climb, location: e.target.value })}
                className={INPUT}
                placeholder="Crag, gym, etc."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Style</label>
                <select
                  value={climb.style}
                  onChange={(e) =>
                    setEditingClimb({
                      ...climb,
                      style: e.target.value as "onsight" | "flash" | "redpoint" | "attempt",
                    })
                  }
                  className={INPUT}
                >
                  <option value="onsight">Onsight</option>
                  <option value="flash">Flash</option>
                  <option value="redpoint">Redpoint</option>
                  <option value="attempt">Attempt</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Attempts</label>
                <input
                  type="number"
                  min="1"
                  value={climb.attempts}
                  onChange={(e) =>
                    setEditingClimb({ ...climb, attempts: parseInt(e.target.value) || 1 })
                  }
                  className={INPUT}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Date</label>
              <input
                type="date"
                value={climb.date}
                onChange={(e) => setEditingClimb({ ...climb, date: e.target.value })}
                className={INPUT}
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={handleSubmit}
              className="flex-1 bg-green-600 text-white py-2 px-4 rounded-xl hover:bg-green-700 transition-colors"
            >
              Save Changes
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-gray-700 text-gray-300 py-2 px-4 rounded-xl hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
