import { GYM_WORKOUTS, GYM_CATEGORIES } from "../../data/gymWorkouts";
import type { GymWorkoutDef } from "../../data/gymWorkouts";
import type { GymWorkoutType } from "../../lib/history";
import { DumbbellIcon } from "../icons";
import { PILL_CLS, PILL_ON_CLS, PILL_OFF_CLS } from "./styles";

type Props = {
  def: GymWorkoutDef;
  workoutType: GymWorkoutType;
  hangboardMode: boolean;
  /** Edit mode: the type is fixed, so the picker never opens. */
  editing: boolean;
  open: boolean;
  /** Type awaiting confirmation because the current one holds entries. */
  pendingType: GymWorkoutType | null;
  onSelectType: (t: GymWorkoutType) => void;
  onSelectHangboard: () => void;
  onOpen: () => void;
  onConfirmSwitch: () => void;
  onCancelSwitch: () => void;
};

/** Type pills (plus the Hangboard pill) that collapse to the chosen one. */
export function WorkoutTypePicker({
  def,
  workoutType,
  hangboardMode,
  editing,
  open,
  pendingType,
  onSelectType,
  onSelectHangboard,
  onOpen,
  onConfirmSwitch,
  onCancelSwitch,
}: Props) {
  return (
    <div>
      {open && !editing ? (
        <div className="flex flex-col gap-3">
          {GYM_CATEGORIES.map((cat) => (
            <div key={cat.id}>
              <p className="text-gray-500 text-xs mb-1.5">{cat.label}</p>
              <div className="flex flex-wrap gap-1.5">
                {GYM_WORKOUTS.filter((w) => w.category === cat.id).map((w) => (
                  <button
                    key={w.id}
                    onClick={() => onSelectType(w.id)}
                    aria-pressed={workoutType === w.id && !hangboardMode}
                    className={`${PILL_CLS} ${
                      workoutType === w.id && !hangboardMode ? PILL_ON_CLS : PILL_OFF_CLS
                    }`}
                  >
                    {w.label}
                  </button>
                ))}
                {/* Hangboard launches the guided timer rather than a log form */}
                {cat.id === "power" && (
                  <button
                    onClick={onSelectHangboard}
                    data-testid="workout-pill-hangboard"
                    aria-pressed={hangboardMode}
                    className={`${PILL_CLS} gap-1.5 ${hangboardMode ? PILL_ON_CLS : PILL_OFF_CLS}`}
                  >
                    <DumbbellIcon size={14} />
                    Hangboard
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => !editing && onOpen()}
          disabled={editing}
          className="inline-flex items-center gap-3 rounded-full disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
        >
          <span className={`${PILL_CLS} gap-1.5 ${PILL_ON_CLS}`}>
            {hangboardMode && <DumbbellIcon size={14} />}
            {hangboardMode ? "Hangboard" : def.label}
          </span>
          {!editing && <span className="text-accent-400 text-sm font-medium">Change</span>}
        </button>
      )}
      {pendingType && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-gray-800 px-3 py-2">
          <p className="flex-1 text-sm text-gray-300">
            Switch to {GYM_WORKOUTS.find((w) => w.id === pendingType)?.label}? Current entries will be cleared.
          </p>
          <button
            type="button"
            onClick={onConfirmSwitch}
            className="h-9 text-sm font-semibold text-gray-900 bg-accent-500 rounded-lg px-3"
          >
            Switch
          </button>
          <button
            type="button"
            onClick={onCancelSwitch}
            className="h-9 text-sm font-semibold text-gray-400 hover:text-white px-2"
          >
            Cancel
          </button>
        </div>
      )}
      {!hangboardMode && <p className="text-gray-400 text-sm mt-3">{def.description}</p>}
    </div>
  );
}
