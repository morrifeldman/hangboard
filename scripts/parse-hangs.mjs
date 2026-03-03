#!/usr/bin/env node
// Usage: node scripts/parse-hangs.mjs [input.hangs] [output.json]
// Defaults: hangs.hangs → hangs.json

import { readFileSync, writeFileSync } from "fs";
import { randomUUID } from "crypto";

const HOLDS_A = [
  { id: "jug",          name: "Jug",          defaultSet1Weight: 0,     set1Reps: 7, set2Reps: 6, skipProgression: true },
  { id: "large-edge",   name: "Large Edge",   defaultSet1Weight: 5,     set1Reps: 7, set2Reps: 6 },
  { id: "mr-shallow",   name: "MR Shallow",   defaultSet1Weight: -35,   set1Reps: 7, set2Reps: 6 },
  { id: "small-edge",   name: "Small Edge",   defaultSet1Weight: -20,   set1Reps: 7, set2Reps: 6 },
  { id: "small-crimp",  name: "Small Crimp",  defaultSet1Weight: -50,   set1Reps: 7, set2Reps: 6 },
  { id: "imr-shallow",  name: "IMR Shallow",  defaultSet1Weight: 10,    set1Reps: 7, set2Reps: 6 },
  { id: "wide-pinch",   name: "Wide Pinch",   defaultSet1Weight: -45,   set1Reps: 7, set2Reps: 6 },
  { id: "sloper",       name: "Sloper",       defaultSet1Weight: -17.5, set1Reps: 7, set2Reps: 6 },
  { id: "med-pinch",    name: "Med Pinch",    defaultSet1Weight: -50,   set1Reps: 7, set2Reps: 6 },
];

const NAME_TO_ID_A = Object.fromEntries(HOLDS_A.map((h) => [h.name.toLowerCase(), h.id]));
// Common typo aliases
NAME_TO_ID_A["wide pince"] = "wide-pinch";

const SET2_OFFSET = 10; // lbs heavier for set 2

function parseHoldLine(line) {
  const noteMatch = line.match(/\[([^\]]+)\]/);
  const note = noteMatch ? noteMatch[1] : null;
  const withoutNote = line.replace(/\s*\[[^\]]*\]/, "").trim();
  const weightMatch = withoutNote.match(/^(.*?)\s+([-+]?\d+(?:\.\d+)?)\s*$/);
  if (weightMatch) return { name: weightMatch[1].trim(), weight: parseFloat(weightMatch[2]), note };
  return { name: withoutNote, weight: null, note };
}

// small-crimp and small-edge are mutually exclusive alternatives.
// A session satisfies the "small finger" slot if either is present.
const SMALL_FINGER_IDS = new Set(["small-edge", "small-crimp"]);

// Note phrases that indicate set 2 was not completed
const BAILED_SET2_PHRASES = ["bailed on second", "bailed set 2", "failed set 2", "skipped set 2"];

function set2Bailed(note) {
  if (!note) return false;
  const lower = note.toLowerCase();
  return BAILED_SET2_PHRASES.some((p) => lower.includes(p));
}

// Returns true if a line is a hold line (starts with a known hold name)
function isHoldLine(line) {
  const { name } = parseHoldLine(line);
  return NAME_TO_ID_A[name.toLowerCase()] !== undefined;
}

function parseSessions(text) {
  const lines = text.split("\n").map((l) => l.trim());
  const sessions = [];
  let i = 0;

  while (i < lines.length) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(lines[i])) { i++; continue; }
    const date = lines[i++];
    if (i >= lines.length) break;

    // Session code is optional — skip it if the next line is already a hold line
    let sessionCode = "";
    if (!isHoldLine(lines[i]) && !/^\d{4}-\d{2}-\d{2}$/.test(lines[i]) && lines[i]) {
      sessionCode = lines[i++];
    }

    const holdWeights = {};
    const holdNotes = {};
    const seenHolds = new Set();

    while (i < lines.length && !/^\d{4}-\d{2}-\d{2}$/.test(lines[i])) {
      const line = lines[i++];
      if (!line) continue;
      const { name, weight, note } = parseHoldLine(line);
      const holdId = NAME_TO_ID_A[name.toLowerCase()];
      if (!holdId) continue;
      seenHolds.add(holdId);
      if (weight !== null) holdWeights[holdId] = weight;
      if (note) holdNotes[holdId] = note;
    }

    const ts = new Date(`${date}T12:00:00`).getTime();

    // small-crimp and small-edge are alternatives — only include the one that was used
    const holds = HOLDS_A
      .filter((hold) => {
        if (hold.id === "small-crimp") return seenHolds.has("small-crimp");
        if (hold.id === "small-edge") return !seenHolds.has("small-crimp");
        return true;
      })
      .map((hold) => {
        const done = hold.skipProgression || seenHolds.has(hold.id);
        const note = holdNotes[hold.id] ?? null;
        const w = hold.skipProgression ? 0 : (holdWeights[hold.id] ?? hold.defaultSet1Weight);
        const set2Done = done && !set2Bailed(note);
        return {
          holdId: hold.id,
          holdName: hold.name,
          set1: { weight: w, reps: hold.set1Reps, completed: done },
          set2: { weight: hold.skipProgression ? 0 : w + SET2_OFFSET, reps: hold.set2Reps, completed: set2Done },
          ...(note ? { notes: note } : {}),
        };
      });

    // bailed if any standard non-skipProgression hold is missing,
    // treating small-edge and small-crimp as one interchangeable slot
    const smallFingerSeen = seenHolds.has("small-edge") || seenHolds.has("small-crimp");
    const bailed = HOLDS_A.some((h) => {
      if (h.skipProgression) return false;
      if (SMALL_FINGER_IDS.has(h.id)) return !smallFingerSeen;
      return !seenHolds.has(h.id);
    });

    sessions.push({
      id: randomUUID(),
      workoutType: "a",
      startedAt: ts,
      completedAt: ts,
      bailed,
      imported: true,
      ...(sessionCode ? { notes: sessionCode } : {}),
      holds,
    });
  }

  return sessions;
}

const inputFile = process.argv[2] ?? "hangs.hangs";
const outputFile = process.argv[3] ?? inputFile.replace(/\.hangs$/, ".json");

const text = readFileSync(inputFile, "utf8");
const sessions = parseSessions(text);
writeFileSync(outputFile, JSON.stringify(sessions, null, 2));
console.log(`Parsed ${sessions.length} session(s) → ${outputFile}`);
