import {
  generateSets,
  parseScheme,
  schemeToFields,
} from "./lifts";
import type { LiftDefinition, LiftDraft, LiftEntry, LiftSet, SchemeFields } from "./lifts";

/** A lift being filled in. The scheme stays text so a half-typed base isn't snapped to 0. */
export type LiftRow = {
  liftId?: string;
  name: string;
  scheme: SchemeFields;
  sets: LiftSet[];
  nextBase: number;
};

const NEW_SCHEME: SchemeFields = { baseWeight: "", sets: "3", reps: "5", repDiff: "0", weightDiff: "0" };

export function emptyLiftRow(): LiftRow {
  return { name: "", scheme: { ...NEW_SCHEME }, sets: [], nextBase: 0 };
}

export function liftRowsFromEntries(entries: LiftEntry[]): LiftRow[] {
  return entries.map((e) => ({
    liftId: e.liftId,
    name: e.name,
    scheme: schemeToFields(e.scheme),
    sets: e.sets.map((s) => ({ ...s })),
    nextBase: e.nextBase,
  }));
}

export function liftRowHasEntries(row: LiftRow): boolean {
  return row.name.trim() !== "" || row.sets.some((s) => s.done);
}

/** Null until the row names a lift with a usable scheme. */
export function liftRowToDraft(row: LiftRow): LiftDraft | null {
  const name = row.name.trim();
  const scheme = parseScheme(row.scheme);
  if (!name || !scheme || row.sets.length === 0) return null;
  return { ...(row.liftId ? { liftId: row.liftId } : {}), name, scheme, sets: row.sets, nextBase: row.nextBase };
}

/** Lay out fresh sets for a new scheme, with the next base starting at the current base. */
export function withScheme(row: LiftRow, scheme: SchemeFields): LiftRow {
  const parsed = parseScheme(scheme);
  return {
    ...row,
    scheme,
    sets: parsed ? generateSets(parsed) : [],
    nextBase: parsed ? parsed.baseWeight : row.nextBase,
  };
}

/**
 * Point a past session's row at a library lift. Sets already logged are what
 * happened, so they stay; only a freshly added row takes the lift's sets.
 */
export function relinkLiftRow(row: LiftRow, lift: LiftDefinition): LiftRow {
  const linked = { ...row, liftId: lift.id, name: lift.name };
  return row.sets.length > 0 ? linked : withScheme(linked, schemeToFields(lift));
}
