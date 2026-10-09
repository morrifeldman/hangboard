import type { SessionRecord, GymData, FreeformSection, CampusSet } from "./history";
import { CAMPUS_TEMPLATE, CAMPUS_SEQUENCES } from "../data/gymWorkouts";
import type { GymWorkoutDef } from "../data/gymWorkouts";

// Pure helpers behind the gym log form. No React, no DOM: unit-tested in
// __tests__/gymForm.test.ts.

// ---- Generic fieldDefs forms -------------------------------------------------

// Extract field values from existing gymData into a flat string map for editing.
// Arrays are joined with "," — round-trips via the multi-select renderer.
export function gymDataToFields(gymData: GymData): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(gymData)) {
    if (k === "type" || v === undefined) continue;
    fields[k] = Array.isArray(v) ? v.join(",") : String(v);
  }
  return fields;
}

// Build a GymData from a workout def + field string values; returns null if required fields missing
export function buildGymData(def: GymWorkoutDef, fields: Record<string, string>): GymData | null {
  const values: Record<string, string | number | string[]> = { type: def.id };
  for (const fd of def.fieldDefs) {
    const raw = fields[fd.key]?.trim() ?? "";
    if (!raw && !fd.optional) return null; // required field missing
    if (!raw) continue; // optional and empty — omit
    if (fd.type === "number") {
      const n = parseFloat(raw);
      if (isNaN(n)) return null;
      values[fd.key] = n;
    } else if (fd.type === "multi-select") {
      values[fd.key] = raw.split(",").map((s) => s.trim()).filter(Boolean);
    } else {
      values[fd.key] = raw;
    }
  }
  return values as unknown as GymData;
}

export function isFormValid(def: GymWorkoutDef, fields: Record<string, string>): boolean {
  return buildGymData(def, fields) !== null;
}

// Compare only non-blank values (cleared/backspaced fields leave "" behind,
// and saved defaults can contain "" too), independent of key order.
export function meaningfulFields(m: Record<string, string>): string {
  return JSON.stringify(
    Object.entries(m)
      .filter(([, v]) => v.trim() !== "")
      .sort(([a], [b]) => a.localeCompare(b))
  );
}

// ---- Freeform ----------------------------------------------------------------

export function emptyFreeformSections(): FreeformSection[] {
  return [{ name: "", entries: [{ key: "", value: "" }] }];
}

// Build a freeform GymData; drops empty entries and empty unnamed sections.
// Returns null when the result has no title or no remaining non-empty entries.
export function buildFreeformGymData(title: string, sections: FreeformSection[]): GymData | null {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) return null;
  const cleanedSections: FreeformSection[] = [];
  let totalEntries = 0;
  for (const sec of sections) {
    const name = sec.name.trim();
    const entries = sec.entries
      .map((e) => ({ key: e.key.trim(), value: e.value.trim() }))
      .filter((e) => e.key !== "" || e.value !== "");
    if (entries.length === 0 && name === "") continue;
    cleanedSections.push({ name, entries });
    totalEntries += entries.length;
  }
  if (totalEntries === 0) return null;
  return { type: "freeform", title: trimmedTitle, sections: cleanedSections };
}

// What a freeform log actually says, ignoring blank rows and stray spaces.
export function freeformFingerprint(title: string, sections: FreeformSection[]): string {
  return JSON.stringify([
    title.trim(),
    sections
      .map((s) => [
        s.name.trim(),
        s.entries.filter((e) => e.key.trim() || e.value.trim()).map((e) => [e.key.trim(), e.value.trim()]),
      ])
      .filter(([name, entries]) => name !== "" || entries.length > 0),
  ]);
}

// ---- Campus ------------------------------------------------------------------

/** A campus set as the form edits it: the saved shape plus a client-only `uid`. */
export type CampusRow = CampusSet & { uid: string };

let nextUid = 0;
/** Stable identity for a row, so deleting a sibling can't shift per-row UI state onto it. */
export function newRowUid(): string {
  return `campus-row-${++nextUid}`;
}

export function campusRowsFromSets(sets: readonly CampusSet[]): CampusRow[] {
  return sets.map((s) => ({ ...s, uid: newRowUid() }));
}

export function emptyCampusRow(): CampusRow {
  return { rung: "", name: "", sequence: "", uid: newRowUid() };
}

export function campusTemplateRows(): CampusRow[] {
  return campusRowsFromSets(CAMPUS_TEMPLATE);
}

/** Rows without their client-only uid: what the dirty check compares. */
export function campusRowsToSets(rows: readonly CampusRow[]): CampusSet[] {
  return rows.map((row) => {
    const { uid, ...set } = row;
    void uid;
    return set;
  });
}

// Build a campus GymData; drops fully-empty rows. Returns null when no row has content.
// Rebuilds each row field by field, so a client-only `uid` can never reach storage.
export function buildCampusGymData(sets: readonly CampusSet[]): GymData | null {
  const cleaned: CampusSet[] = [];
  for (const s of sets) {
    const rung = s.rung.trim();
    const name = s.name.trim();
    const sequence = s.sequence.trim();
    const note = s.note?.trim();
    if (!rung && !name && !sequence && !note) continue;
    cleaned.push({ rung, name, sequence, ...(note ? { note } : {}) });
  }
  if (cleaned.length === 0) return null;
  return { type: "campus", sets: cleaned };
}

// Past campus sequences grouped by ladder name — merged with presets so the dropdowns grow.
export function collectCampusSequences(sessions: SessionRecord[]): Record<string, string[]> {
  const byName: Record<string, Set<string>> = {};
  for (const s of sessions) {
    if (s.gymData?.type !== "campus") continue;
    for (const row of s.gymData.sets) {
      if (!row.name || !row.sequence) continue;
      (byName[row.name] ??= new Set<string>()).add(row.sequence);
    }
  }
  const out: Record<string, string[]> = {};
  for (const [name, set] of Object.entries(byName)) out[name] = Array.from(set);
  return out;
}

/** Preset sequences for a ladder name plus previously-logged ones. */
export function sequenceOptionsFor(name: string, logged: Record<string, string[]>): string[] {
  return Array.from(new Set([...(CAMPUS_SEQUENCES[name] ?? []), ...(logged[name] ?? [])]));
}

// ---- Autocomplete from past sessions -------------------------------------------

export type FreeformAutocomplete = {
  keys: string[];
  sectionNames: string[];
  /** Newest freeform log, skipping `excludeId` (the record being edited). */
  lastFreeform: SessionRecord | undefined;
};

// `sessions` are newest-first, as getSessions() returns them.
export function collectFreeformAutocomplete(
  sessions: SessionRecord[],
  excludeId?: string,
): FreeformAutocomplete {
  const keys = new Set<string>();
  const sectionNames = new Set<string>();
  let lastFreeform: SessionRecord | undefined;
  for (const s of sessions) {
    if (s.gymData?.type !== "freeform") continue;
    if (!lastFreeform && s.id !== excludeId) lastFreeform = s;
    for (const sec of s.gymData.sections) {
      if (sec.name) sectionNames.add(sec.name);
      for (const e of sec.entries) {
        if (e.key) keys.add(e.key);
      }
    }
  }
  return {
    keys: Array.from(keys).sort(),
    sectionNames: Array.from(sectionNames).sort(),
    lastFreeform,
  };
}

export type GymAutocomplete = FreeformAutocomplete & { campusSequences: Record<string, string[]> };

export function collectGymAutocomplete(sessions: SessionRecord[], excludeId?: string): GymAutocomplete {
  return {
    ...collectFreeformAutocomplete(sessions, excludeId),
    campusSequences: collectCampusSequences(sessions),
  };
}

// ---- Durations (campus rest timer) --------------------------------------------

export function formatMMSS(secs: number): string {
  const m = Math.floor(secs / 60);
  return `${m}:${String(secs % 60).padStart(2, "0")}`;
}

// Accepts plain seconds ("90") or m:ss ("1:30"); returns null on garbage.
export function parseDurationInput(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  if (t.includes(":")) {
    const [m, s] = t.split(":");
    const mins = parseInt(m, 10);
    const secs = parseInt(s, 10);
    if (isNaN(mins) || isNaN(secs)) return null;
    return mins * 60 + secs;
  }
  const n = parseInt(t, 10);
  return isNaN(n) ? null : n;
}
