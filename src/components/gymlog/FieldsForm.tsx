import type { Dispatch, SetStateAction } from "react";
import type { GymWorkoutDef } from "../../data/gymWorkouts";
import { V_GRADES, YDS_GRADES } from "../../lib/gradeUtils";
import { PILL_ON_CLS, STEP_BTN_CLS, STEP_VALUE_CLS } from "./styles";

type Props = {
  def: GymWorkoutDef;
  fields: Record<string, string>;
  /** Takes updater functions too, so rapid stepper taps accumulate. */
  onChange: Dispatch<SetStateAction<Record<string, string>>>;
};

/** The generic renderer for a workout type's `fieldDefs`. */
export function FieldsForm({ def, fields, onChange }: Props) {
  const hasUnits = def.fieldDefs.some((fd) => fd.unit);
  const hasOptional = def.fieldDefs.some((fd) => fd.optional);

  const setField = (key: string, value: string) => onChange((prev) => ({ ...prev, [key]: value }));

  // Stepper for number fields — bumps the current value (blank counts as 0),
  // clamped at 0 so counts/durations never go negative.
  const stepField = (key: string, delta: number) =>
    onChange((prev) => {
      const cur = parseFloat(prev[key] ?? "");
      const base = Number.isFinite(cur) ? cur : 0;
      return { ...prev, [key]: String(Math.max(0, base + delta)) };
    });

  // Stepper for grade fields — moves one step through the grade scale, clamped
  // at the ends. From empty (no default yet) it starts mid-scale.
  const stepGrade = (key: string, grades: string[], delta: number) =>
    onChange((prev) => {
      const idx = grades.indexOf(prev[key] ?? "");
      const next =
        idx === -1
          ? grades[Math.floor(grades.length / 2)]
          : grades[Math.min(grades.length - 1, Math.max(0, idx + delta))];
      return { ...prev, [key]: next };
    });

  const toggleMultiSelect = (key: string, opt: string) => {
    const current = (fields[key] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const next = current.includes(opt) ? current.filter((o) => o !== opt) : [...current, opt];
    setField(key, next.join(","));
  };

  if (def.fieldDefs.length === 0) return null;

  return (
    <div className="bg-gray-800 rounded-2xl overflow-hidden shrink-0 divide-y divide-gray-700/60">
      {/* shrink-0 above is load-bearing: overflow-hidden zeroes the card's min
          flex size, so without it the card compresses (clipping its last rows)
          instead of the page scrolling */}
      {def.fieldDefs.map((fd) => {
        const isGrade = fd.type === "grade-v" || fd.type === "grade-yds";
        const grades = fd.type === "grade-v" ? V_GRADES : YDS_GRADES;
        const value = fields[fd.key] ?? "";
        const label = (
          <div className="flex-1 min-w-0">
            <label className="text-gray-200 text-sm leading-tight block">{fd.label}</label>
            {fd.optional && <span className="text-gray-500 text-xs leading-tight">Optional</span>}
          </div>
        );
        if (fd.type === "multi-select") {
          const selected = new Set(value.split(",").map((s) => s.trim()).filter(Boolean));
          return (
            <div key={fd.key} className="px-4 py-3">
              <div className="flex items-center mb-2">
                {label}
                {fd.optional && selected.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setField(fd.key, "")}
                    className="text-sm font-medium text-gray-500 hover:text-red-400 px-2 py-1"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {fd.options?.map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => toggleMultiSelect(fd.key, o)}
                    aria-pressed={selected.has(o)}
                    className={`h-9 px-3 rounded-full text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 ${
                      selected.has(o) ? PILL_ON_CLS : "bg-gray-700/70 text-gray-300"
                    }`}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>
          );
        }
        if (fd.type === "select") {
          // Tapping the chosen segment again clears an optional field, standing in
          // for the "—" entry the old dropdown had.
          return (
            <div key={fd.key} className="px-4 py-3">
              <div className="mb-2">{label}</div>
              <div role="radiogroup" aria-label={fd.label} className="flex gap-1 rounded-xl bg-gray-900/60 p-1">
                {fd.options?.map((o) => (
                  <button
                    key={o}
                    type="button"
                    role="radio"
                    aria-checked={value === o}
                    onClick={() => setField(fd.key, value === o && fd.optional ? "" : o)}
                    className={`flex-1 h-9 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 ${
                      value === o ? PILL_ON_CLS : "text-gray-400 hover:text-white"
                    }`}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>
          );
        }
        return (
          <div key={fd.key} className="px-4 py-2.5 flex items-center gap-2">
            {label}
            {isGrade ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => stepGrade(fd.key, grades, -1)}
                  aria-label={`Decrease ${fd.label}`}
                  className={STEP_BTN_CLS}
                >
                  −
                </button>
                <select
                  value={value}
                  onChange={(e) => setField(fd.key, e.target.value)}
                  aria-label={fd.label}
                  className={`w-16 appearance-none ${STEP_VALUE_CLS} ${value ? "" : "!text-gray-500"}`}
                >
                  <option value="">—</option>
                  {grades.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => stepGrade(fd.key, grades, 1)}
                  aria-label={`Increase ${fd.label}`}
                  className={STEP_BTN_CLS}
                >
                  +
                </button>
              </div>
            ) : fd.type === "text" ? (
              <input
                type="text"
                autoComplete="off"
                aria-label={fd.label}
                value={value}
                onChange={(e) => setField(fd.key, e.target.value)}
                className="w-40 h-10 bg-gray-700/70 text-white rounded-lg px-3 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
              />
            ) : (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => stepField(fd.key, -(fd.step ?? 1))}
                  aria-label={`Decrease ${fd.label}`}
                  className={STEP_BTN_CLS}
                >
                  −
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  step={fd.step ?? 1}
                  autoComplete="off"
                  aria-label={fd.label}
                  value={value}
                  onChange={(e) => setField(fd.key, e.target.value)}
                  placeholder="—"
                  className={`w-16 placeholder-gray-500 ${STEP_VALUE_CLS} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                />
                <button
                  type="button"
                  onClick={() => stepField(fd.key, fd.step ?? 1)}
                  aria-label={`Increase ${fd.label}`}
                  className={STEP_BTN_CLS}
                >
                  +
                </button>
              </div>
            )}
            {/* Reserve the unit and clear slots on every row so the steppers line up */}
            {hasUnits && <span className="text-gray-500 text-xs w-7 shrink-0">{fd.unit}</span>}
            {fd.optional ? (
              <button
                type="button"
                onClick={() => setField(fd.key, "")}
                disabled={!value.trim()}
                aria-label={`Clear ${fd.label}`}
                className="shrink-0 w-6 h-10 -mr-1 flex items-center justify-center text-lg leading-none text-gray-500 hover:text-red-400 disabled:opacity-0 disabled:pointer-events-none"
              >
                ×
              </button>
            ) : (
              hasOptional && <span className="w-6 -mr-1 shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}
