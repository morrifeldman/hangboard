import { useState } from "react";
import { SPORT_GRADES, BOULDER_GRADES } from "../../../constants/climbGrades";
import type { ClimbSetting, ClimbStyle, ClimbType } from "../../../constants/climbGrades";
import type { ClimbRecord } from "../../../lib/climbs";

/** A climb being added (no id yet) or edited. */
export type ClimbDraft = Omit<ClimbRecord, "id"> & { id?: string };

type Props = {
  initial: ClimbDraft;
  onClose: () => void;
  /** Persist the climb; the modal stays open with an error if this throws. */
  onSave: (climb: ClimbRecord) => Promise<void>;
};

const INPUT = "w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-500 placeholder-gray-500";
const LABEL = "block text-sm font-medium text-gray-400 mb-1";

/** One form for adding and editing a climb. Mount with a `key` so each open starts fresh. */
export function ClimbFormModal({ initial, onClose, onSave }: Props) {
  const [climb, setClimb] = useState<ClimbDraft>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editing = initial.id !== undefined;
  const set = (patch: Partial<ClimbDraft>) => setClimb((c) => ({ ...c, ...patch }));

  const grades: readonly string[] = climb.type === "boulder" ? BOULDER_GRADES : SPORT_GRADES;
  const canSave = climb.route.trim() !== "" && grades.includes(climb.grade) && !busy;

  const handleSubmit = async () => {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      await onSave({ ...climb, id: climb.id ?? crypto.randomUUID(), route: climb.route.trim() });
    } catch (err) {
      console.error(err);
      setError("Couldn't save. Try again.");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-white">{editing ? "Edit climb" : "Add climb"}</h3>
            <button onClick={onClose} aria-label="Close" className="-mr-2 px-2 text-gray-500 hover:text-white text-2xl">
              &times;
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className={LABEL}>Route name</label>
              <input
                type="text"
                value={climb.route}
                onChange={(e) => set({ route: e.target.value })}
                className={INPUT}
                placeholder="Enter route name"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={LABEL}>Type</label>
                <select
                  value={climb.type}
                  // Sport and boulder grades don't overlap, so a type switch clears the grade.
                  onChange={(e) => set({ type: e.target.value as ClimbType, grade: "" })}
                  className={INPUT}
                >
                  <option value="sport">Sport/Trad</option>
                  <option value="boulder">Boulder</option>
                </select>
              </div>
              <div>
                <label className={LABEL}>Setting</label>
                <select
                  value={climb.setting}
                  onChange={(e) => set({ setting: e.target.value as ClimbSetting })}
                  className={INPUT}
                >
                  <option value="outdoor">Outdoor</option>
                  <option value="indoor">Indoor</option>
                </select>
              </div>
            </div>

            <div>
              <label className={LABEL}>Grade</label>
              <select value={climb.grade} onChange={(e) => set({ grade: e.target.value })} className={INPUT}>
                <option value="">Select grade</option>
                {grades.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={LABEL}>Location</label>
              <input
                type="text"
                value={climb.location}
                onChange={(e) => set({ location: e.target.value })}
                className={INPUT}
                placeholder="Crag, gym, etc."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={LABEL}>Style</label>
                <select
                  value={climb.style}
                  onChange={(e) => set({ style: e.target.value as ClimbStyle })}
                  className={INPUT}
                >
                  <option value="onsight">Onsight</option>
                  <option value="flash">Flash</option>
                  <option value="redpoint">Redpoint</option>
                  <option value="attempt">Attempt</option>
                </select>
              </div>
              <div>
                <label className={LABEL}>Climbs</label>
                <input
                  type="number"
                  min="1"
                  value={climb.climbs}
                  onChange={(e) => set({ climbs: parseInt(e.target.value) || 1 })}
                  className={INPUT}
                />
              </div>
            </div>

            <div>
              <label className={LABEL}>Date</label>
              <input type="date" value={climb.date} onChange={(e) => set({ date: e.target.value })} className={INPUT} />
            </div>

            <div>
              <label className={LABEL}>Notes (optional)</label>
              <textarea
                value={climb.notes || ""}
                onChange={(e) => set({ notes: e.target.value })}
                className={INPUT}
                placeholder="Add notes about this climb..."
                rows={3}
              />
            </div>
          </div>

          {error && <p role="alert" className="mt-4 text-sm text-red-400">{error}</p>}

          <div className="flex gap-3 mt-6">
            <button
              onClick={handleSubmit}
              disabled={!canSave}
              className="flex-1 bg-accent-500 text-gray-900 font-semibold py-2.5 px-4 rounded-lg active:bg-accent-400 transition-colors disabled:bg-gray-700 disabled:text-gray-500"
            >
              {editing ? "Save changes" : "Add climb"}
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-gray-700 text-gray-300 font-semibold py-2.5 px-4 rounded-lg hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
