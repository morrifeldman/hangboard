import { SPORT_GRADES, BOULDER_GRADES } from "../../../constants/climbGrades";
import type { ClimbRecord } from "../../../lib/climbs";

type NewClimbData = Omit<ClimbRecord, "id">;

type Props = {
  isOpen: boolean;
  onClose: () => void;
  newClimb: NewClimbData;
  setNewClimb: (c: NewClimbData) => void;
  onAddClimb: () => void;
};

const INPUT = "w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 placeholder-gray-500";

export function AddClimbModal({ isOpen, onClose, newClimb, setNewClimb, onAddClimb }: Props) {
  if (!isOpen) return null;

  const handleSubmit = () => {
    if (newClimb.route && newClimb.grade) onAddClimb();
  };

  const grades = newClimb.type === "boulder" ? BOULDER_GRADES : SPORT_GRADES;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4 text-white">Add New Climb</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Route Name</label>
              <input
                type="text"
                value={newClimb.route}
                onChange={(e) => setNewClimb({ ...newClimb, route: e.target.value })}
                className={INPUT}
                placeholder="Enter route name"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Type</label>
                <select
                  value={newClimb.type}
                  onChange={(e) =>
                    setNewClimb({ ...newClimb, type: e.target.value as "sport" | "boulder", grade: "" })
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
                  value={newClimb.setting}
                  onChange={(e) =>
                    setNewClimb({ ...newClimb, setting: e.target.value as "outdoor" | "indoor" })
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
                value={newClimb.grade}
                onChange={(e) => setNewClimb({ ...newClimb, grade: e.target.value })}
                className={INPUT}
              >
                <option value="">Select grade</option>
                {grades.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Location</label>
              <input
                type="text"
                value={newClimb.location}
                onChange={(e) => setNewClimb({ ...newClimb, location: e.target.value })}
                className={INPUT}
                placeholder="Crag, gym, etc."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Style</label>
                <select
                  value={newClimb.style}
                  onChange={(e) =>
                    setNewClimb({ ...newClimb, style: e.target.value as "onsight" | "flash" | "redpoint" })
                  }
                  className={INPUT}
                >
                  <option value="onsight">Onsight</option>
                  <option value="flash">Flash</option>
                  <option value="redpoint">Redpoint</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Climbs</label>
                <input
                  type="number"
                  min="1"
                  value={newClimb.climbs}
                  onChange={(e) => setNewClimb({ ...newClimb, climbs: parseInt(e.target.value) || 1 })}
                  className={INPUT}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Date</label>
              <input
                type="date"
                value={newClimb.date}
                onChange={(e) => setNewClimb({ ...newClimb, date: e.target.value })}
                className={INPUT}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Notes (Optional)</label>
              <textarea
                value={newClimb.notes || ""}
                onChange={(e) => setNewClimb({ ...newClimb, notes: e.target.value })}
                className={INPUT}
                placeholder="Add notes about this climb..."
                rows={3}
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={handleSubmit}
              className="flex-1 bg-green-600 text-white py-2 px-4 rounded-xl hover:bg-green-700 transition-colors"
            >
              Add Climb
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
