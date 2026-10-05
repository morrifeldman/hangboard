import type { Dispatch, SetStateAction } from "react";
import { WeightAdjuster } from "./WeightAdjuster";
import {
  LIFT_WEIGHT_STEP,
  findLiftByName,
  formatScheme,
  parseScheme,
  roundToPlate,
  schemeToFields,
} from "../lib/lifts";
import type { LiftDefinition, SchemeFields } from "../lib/lifts";
import { emptyLiftRow, relinkLiftRow, withScheme } from "../lib/liftRows";
import type { LiftRow } from "../lib/liftRows";

const INPUT_CLS =
  "h-10 bg-gray-700/70 text-white rounded-lg px-2 text-base font-num text-center placeholder-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

const NAME_CLS =
  "h-11 bg-gray-700/70 text-white rounded-lg px-3 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400";

const SCHEME_INPUTS: { key: keyof SchemeFields; label: string; step: number }[] = [
  { key: "baseWeight", label: "Base lb", step: LIFT_WEIGHT_STEP },
  { key: "sets", label: "Sets", step: 1 },
  { key: "reps", label: "Reps", step: 1 },
  { key: "repDiff", label: "± reps", step: 1 },
  { key: "weightDiff", label: "± lb", step: LIFT_WEIGHT_STEP },
];

type Props = {
  rows: LiftRow[];
  onChange: Dispatch<SetStateAction<LiftRow[]>>;
  library: LiftDefinition[];
  editing: boolean;
};

export function LiftsForm({ rows, onChange, library, editing }: Props) {
  const update = (i: number, fn: (row: LiftRow) => LiftRow) =>
    onChange((prev) => prev.map((r, j) => (j === i ? fn(r) : r)));

  const setName = (i: number, name: string) =>
    update(i, (row) => {
      const known = findLiftByName(library, name);
      const renamed = { ...row, name };
      return known ? withScheme(renamed, schemeToFields(known)) : renamed;
    });

  const setSet = (i: number, k: number, patch: Partial<LiftRow["sets"][number]>) =>
    update(i, (row) => ({ ...row, sets: row.sets.map((s, j) => (j === k ? { ...s, ...patch } : s)) }));

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row, i) => {
        const known = findLiftByName(library, row.name);
        const parsed = parseScheme(row.scheme);
        return (
          <div key={i} className="bg-gray-800 rounded-2xl" data-testid="lift-card">
            <div className="flex items-center gap-2 p-3">
              {/* A past session can only point at lifts that exist, so editing
                  history never adds to the library. */}
              {editing ? (
                <select
                  value={row.liftId ?? ""}
                  onChange={(e) => {
                    const lift = library.find((l) => l.id === e.target.value);
                    if (lift) update(i, (r) => relinkLiftRow(r, lift));
                  }}
                  aria-label="Lift name"
                  className={`flex-1 min-w-0 ${NAME_CLS} ${row.liftId ? "" : "!text-gray-500"}`}
                >
                  <option value="" disabled hidden>Pick a lift</option>
                  {/* A deleted lift still names its own row. */}
                  {row.liftId && !library.some((l) => l.id === row.liftId) && (
                    <option value={row.liftId}>{row.name}</option>
                  )}
                  {library.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              ) : (
                <input
                  type="text"
                  list="lift-names"
                  value={row.name}
                  onChange={(e) => setName(i, e.target.value)}
                  placeholder="Lift name"
                  aria-label="Lift name"
                  autoComplete="off"
                  className={`flex-1 min-w-0 placeholder-gray-500 ${NAME_CLS}`}
                />
              )}
              <button
                type="button"
                onClick={() => onChange((prev) => prev.filter((_, j) => j !== i))}
                aria-label="Remove lift"
                className="shrink-0 text-gray-500 hover:text-red-400 text-xl leading-none w-8 h-10 flex items-center justify-center"
              >
                ×
              </button>
            </div>

            {(known || editing) && parsed ? (
              <p className="px-4 pb-3 -mt-1 text-sm text-gray-400 font-num">{formatScheme(parsed)}</p>
            ) : (
              <div className="px-3 pb-3 grid grid-cols-5 gap-1.5">
                {SCHEME_INPUTS.map((f) => (
                  <label key={f.key} className="flex flex-col gap-1 min-w-0">
                    <span className="text-gray-500 text-xs text-center">{f.label}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step={f.step}
                      value={row.scheme[f.key]}
                      onChange={(e) =>
                        update(i, (r) => withScheme(r, { ...r.scheme, [f.key]: e.target.value }))
                      }
                      className={`w-full min-w-0 ${INPUT_CLS}`}
                    />
                  </label>
                ))}
              </div>
            )}

            {row.sets.length > 0 && (
              <div className="divide-y divide-gray-700/60 border-t border-gray-700/60">
                <div className="grid grid-cols-[2.5rem_1fr_1fr_2.75rem] gap-2 items-center px-3 py-1.5 text-xs text-gray-500">
                  <span>Set</span>
                  <span className="text-center">lb</span>
                  <span className="text-center">Reps</span>
                  <span className="text-center">Done</span>
                </div>
                {row.sets.map((s, k) => (
                  <div key={k} className="grid grid-cols-[2.5rem_1fr_1fr_2.75rem] gap-2 items-center px-3 py-1.5">
                    <span className="text-gray-400 font-num">{k + 1}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step={LIFT_WEIGHT_STEP}
                      aria-label={`Set ${k + 1} weight`}
                      value={s.weight}
                      onChange={(e) => setSet(i, k, { weight: e.target.value })}
                      className={`w-full min-w-0 ${INPUT_CLS}`}
                    />
                    <input
                      type="number"
                      inputMode="numeric"
                      aria-label={`Set ${k + 1} reps`}
                      value={s.reps}
                      onChange={(e) => setSet(i, k, { reps: e.target.value })}
                      className={`w-full min-w-0 ${INPUT_CLS}`}
                    />
                    <button
                      type="button"
                      onClick={() => setSet(i, k, { done: !s.done })}
                      aria-pressed={s.done}
                      aria-label={`Set ${k + 1} done`}
                      className={`justify-self-center w-9 h-9 rounded-full flex items-center justify-center text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 ${
                        s.done ? "bg-accent-500 text-gray-900" : "border border-gray-600 text-transparent"
                      }`}
                    >
                      ✓
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* A past session's next base was a plan for the session after it, which
                has already happened, so it isn't offered for editing. */}
            {!editing && parsed && (
              <div className="border-t border-gray-700/60 py-3">
                <WeightAdjuster
                  label="Next base"
                  value={row.nextBase}
                  step={LIFT_WEIGHT_STEP}
                  formatValue={(n) => `${n}`}
                  onDelta={(d) => update(i, (r) => ({ ...r, nextBase: Math.max(0, roundToPlate(r.nextBase + d)) }))}
                />
              </div>
            )}
          </div>
        );
      })}

      {(!editing || library.length > 0) && (
      <button
        type="button"
        onClick={() => onChange((prev) => [...prev, emptyLiftRow()])}
        className="self-start text-xs font-semibold text-gray-400 hover:text-white px-3 py-1.5 rounded-full border border-gray-700 bg-gray-800"
      >
        + Add lift
      </button>
      )}
      <datalist id="lift-names">
        {library.map((l) => <option key={l.id} value={l.name} />)}
      </datalist>
    </div>
  );
}
