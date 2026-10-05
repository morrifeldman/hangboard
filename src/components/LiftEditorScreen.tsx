import { useState } from "react";
import { BackChevronIcon } from "./icons";
import { useWorkoutStore } from "../store/useWorkoutStore";
import { LIFT_WEIGHT_STEP, findLiftByName, generateSets, parseScheme, schemeToFields } from "../lib/lifts";
import type { LiftDefinition, SchemeFields } from "../lib/lifts";

type Props = {
  lift: LiftDefinition;
  onBack: () => void;
  onDone: () => void;
};

const FIELDS: { key: keyof SchemeFields; label: string; unit?: string; step: number }[] = [
  { key: "baseWeight", label: "Base weight", unit: "lb", step: LIFT_WEIGHT_STEP },
  { key: "sets", label: "Sets", step: 1 },
  { key: "reps", label: "Reps", step: 1 },
  { key: "repDiff", label: "Reps change per set", step: 1 },
  { key: "weightDiff", label: "Weight change per set", unit: "lb", step: LIFT_WEIGHT_STEP },
];

/** Edits a lift's definition. Past sessions keep their own copy, so nothing here rewrites history. */
export function LiftEditorScreen({ lift, onBack, onDone }: Props) {
  const library = useWorkoutStore((s) => s.lifts);
  const updateLift = useWorkoutStore((s) => s.updateLift);
  const deleteLift = useWorkoutStore((s) => s.deleteLift);

  const [name, setName] = useState(lift.name);
  const [fields, setFields] = useState<SchemeFields>(() => schemeToFields(lift));
  const [confirmDelete, setConfirmDelete] = useState(false);

  const scheme = parseScheme(fields);
  const trimmed = name.trim();
  // Logging links a typed name to a library lift, so two lifts can't share one.
  const clash = findLiftByName(library.filter((l) => l.id !== lift.id), trimmed);
  const valid = trimmed !== "" && scheme !== null && !clash;
  const preview = scheme ? generateSets(scheme).map((s) => `${s.reps}@${s.weight}`).join(", ") : "";

  const handleSave = () => {
    if (!valid || !scheme) return;
    updateLift(lift.id, { name: trimmed, ...scheme });
    onDone();
  };

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    deleteLift(lift.id);
    onDone();
  };

  return (
    <div className="h-full bg-gray-900 flex flex-col">
      <header className="bg-gray-800 px-4 pt-4 pb-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-white transition-colors p-1 -ml-1"
          aria-label="Back"
        >
          <BackChevronIcon />
        </button>
        <h1 className="text-white font-bold text-lg">Edit lift</h1>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-4 pb-8 flex flex-col gap-4">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Lift name"
          placeholder="Lift name"
          className="w-full h-11 bg-gray-800 text-white rounded-lg px-3 text-base placeholder-gray-500 border border-gray-700 focus:outline-none focus:border-accent-500"
        />
        {clash && <p className="-mt-2 text-sm text-red-400">You already have a lift called {clash.name}.</p>}

        <div className="bg-gray-800 rounded-2xl divide-y divide-gray-700/60">
          {FIELDS.map((f) => (
            <label key={f.key} className="px-4 py-2.5 flex items-center gap-2">
              <span className="flex-1 text-gray-200 text-sm">{f.label}</span>
              <input
                type="number"
                inputMode="decimal"
                step={f.step}
                value={fields[f.key]}
                onChange={(e) => setFields((prev) => ({ ...prev, [f.key]: e.target.value }))}
                className="w-20 h-10 bg-gray-700/70 text-white text-center font-num text-lg rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="w-6 text-gray-500 text-xs">{f.unit}</span>
            </label>
          ))}
        </div>
        {preview && <p className="text-sm text-gray-400 font-num">{preview}</p>}
      </div>

      <div className="px-4 pb-6 pt-3 flex flex-col gap-3 shrink-0 border-t border-gray-800">
        <button
          onClick={handleSave}
          disabled={!valid}
          className="w-full h-12 rounded-xl font-semibold bg-accent-500 text-gray-900 text-base transition-colors disabled:bg-gray-700 disabled:text-gray-500"
        >
          Save changes
        </button>
        <button
          onClick={handleDelete}
          className={`w-full h-11 rounded-xl font-semibold text-base transition-colors ${
            confirmDelete ? "bg-red-600 text-white" : "bg-gray-800 text-red-400"
          }`}
        >
          {confirmDelete ? "Tap again to delete" : "Delete lift"}
        </button>
        <p className="text-center text-xs text-gray-500">Deleting keeps the sessions you've logged.</p>
      </div>
    </div>
  );
}
