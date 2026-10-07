import type { Dispatch, SetStateAction } from "react";
import { WeightAdjuster } from "./WeightAdjuster";
import { WeightCell } from "./WeightCell";
import { useOpenCell } from "../hooks/useOpenCell";
import { NextArrow } from "./NextArrow";
import { liftNextDirection } from "../lib/weightCues";
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
  "h-9 bg-gray-700/70 text-white rounded-lg px-2 text-base font-num text-center placeholder-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

const NAME_CLS =
  "h-10 bg-gray-700/70 text-white rounded-lg px-3 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400";

const plain = (n: number) => `${n}`;
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");

// The base is typed, since it can be hundreds of pounds from zero; the rest
// are small numbers that −/+ reach quickly.
const SCHEME_STEPPERS: {
  key: Exclude<keyof SchemeFields, "baseWeight">;
  label: string;
  step: number;
  min?: number;
  format: (n: number) => string;
}[] = [
  { key: "sets", label: "Sets", step: 1, min: 1, format: plain },
  { key: "reps", label: "Reps", step: 1, min: 1, format: plain },
  { key: "repDiff", label: "± reps", step: 1, format: signed },
  { key: "weightDiff", label: "± lb", step: LIFT_WEIGHT_STEP, format: signed },
];

type Props = {
  rows: LiftRow[];
  onChange: Dispatch<SetStateAction<LiftRow[]>>;
  library: LiftDefinition[];
  editing: boolean;
};

export function LiftsForm({ rows, onChange, library, editing }: Props) {
  const [openCell, setOpenCell] = useOpenCell();
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
    <div className="flex flex-col gap-2.5">
      {rows.map((row, i) => {
        const known = findLiftByName(library, row.name);
        const parsed = parseScheme(row.scheme);
        return (
          <div key={i} className="bg-gray-800 rounded-2xl" data-testid="lift-card">
            <div className="flex items-center gap-1 pl-2.5 pr-1 pt-2.5 pb-1.5">
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
                className="shrink-0 text-gray-500 hover:text-red-400 text-xl leading-none w-9 h-10 flex items-center justify-center"
              >
                ×
              </button>
            </div>

            {(known || editing) && parsed ? (
              <p className="px-3.5 pb-2 text-sm text-gray-400 font-num">{formatScheme(parsed)}</p>
            ) : (
              <div className="px-2.5 pb-2 grid grid-cols-5 gap-1">
                <label className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-gray-500 text-xs text-center">Base lb</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step={LIFT_WEIGHT_STEP}
                    value={row.scheme.baseWeight}
                    onChange={(e) =>
                      update(i, (r) => withScheme(r, { ...r.scheme, baseWeight: e.target.value }))
                    }
                    className={`w-full min-w-0 ${INPUT_CLS}`}
                  />
                </label>
                {SCHEME_STEPPERS.map((f, n) => {
                  const cellKey = `${i}:${f.key}`;
                  return (
                    <div key={f.key} className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-gray-500 text-xs text-center">{f.label}</span>
                      <WeightCell
                        label={f.label}
                        value={Number(row.scheme[f.key])}
                        onChange={(v) => update(i, (r) => withScheme(r, { ...r.scheme, [f.key]: String(v) }))}
                        completed
                        step={f.step}
                        min={f.min}
                        formatValue={f.format}
                        open={openCell === cellKey}
                        onOpen={() => setOpenCell(cellKey)}
                        align={n === SCHEME_STEPPERS.length - 1 ? "end" : "center"}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {row.sets.length > 0 && (
              <div className="divide-y divide-gray-700/60 border-t border-gray-700/60">
                <div className="grid grid-cols-[2rem_1fr_1fr_2.5rem] gap-2 items-center px-3 py-1 text-xs text-gray-500">
                  <span>Set</span>
                  <span className="text-center">lb</span>
                  <span className="text-center">Reps</span>
                  <span className="text-center">Done</span>
                </div>
                {row.sets.map((s, k) => (
                  <div key={k} className="grid grid-cols-[2rem_1fr_1fr_2.5rem] gap-2 items-center px-3 py-0.5">
                    <span className="text-gray-400 font-num">{k + 1}</span>
                    <WeightCell
                      label={`Set ${k + 1} weight`}
                      value={s.weight}
                      onChange={(weight) => setSet(i, k, { weight })}
                      completed
                      step={LIFT_WEIGHT_STEP}
                      min={0}
                      formatValue={plain}
                      open={openCell === `${i}:${k}:weight`}
                      onOpen={() => setOpenCell(`${i}:${k}:weight`)}
                    />
                    <WeightCell
                      label={`Set ${k + 1} reps`}
                      value={s.reps}
                      onChange={(reps) => setSet(i, k, { reps })}
                      completed
                      step={1}
                      min={1}
                      formatValue={plain}
                      open={openCell === `${i}:${k}:reps`}
                      onOpen={() => setOpenCell(`${i}:${k}:reps`)}
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
              <div className="border-t border-gray-700/60 px-3.5 py-2 flex items-center justify-between gap-2">
                <span className="text-gray-400 text-sm">Next base</span>
                <WeightAdjuster
                  value={row.nextBase}
                  step={LIFT_WEIGHT_STEP}
                  formatValue={(n) => `${n}`}
                  onDelta={(d) => update(i, (r) => ({ ...r, nextBase: Math.max(0, roundToPlate(r.nextBase + d)) }))}
                />
              </div>
            )}
            {editing && parsed && (
              <p className="border-t border-gray-700/60 px-3.5 py-2 text-xs text-gray-500">
                Next base <span className="font-num">{row.nextBase}</span>
                <NextArrow dir={liftNextDirection({ nextBase: row.nextBase, scheme: parsed })} />
              </p>
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
