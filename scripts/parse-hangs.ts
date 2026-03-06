#!/usr/bin/env npx tsx
/**
 * Converts a .hangs file to JSON matching the app's SessionRecord[] type.
 * Usage: npx tsx scripts/parse-hangs.ts [input.hangs] [output.json]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// ─── Hold name → ID mapping ────────────────────────────────────────────────────
// Keys sorted longest-first so "mr shallow" matches before "mr"
const HOLD_ID: Record<string, string> = {
  "large edge":  "large-edge",
  "mr shallow":  "mr-shallow",
  "med edge":    "small-edge",
  "small edge":  "small-edge",   // injury alias
  "small crimp": "small-crimp",
  "imr shallow": "imr-shallow",
  "imr deep":    "imr-deep",
  "wide pinch":  "wide-pinch",
  "sloper":      "sloper",
  "med pinch":   "med-pinch",
  "mr deep":     "mr-deep",
  "mrp":         "mrp",
  "jug":         "jug",
};

const HOLD_DISPLAY: Record<string, string> = {
  "large-edge":  "Large Edge",
  "mr-shallow":  "MR Shallow",
  "small-edge":  "Med Edge",
  "small-crimp": "Small Crimp",
  "imr-shallow": "IMR Shallow",
  "imr-deep":    "IMR Deep",
  "wide-pinch":  "Wide Pinch",
  "sloper":      "Sloper",
  "med-pinch":   "Med Pinch",
  "mr-deep":     "MR Deep",
  "mrp":         "MRP",
  "jug":         "Jug",
};

const HOLD_KEYS_BY_LENGTH = Object.keys(HOLD_ID).sort((a, b) => b.length - a.length);

function matchHoldName(line: string): string | null {
  const lower = line.toLowerCase();
  return HOLD_KEYS_BY_LENGTH.find((k) => lower.startsWith(k)) ?? null;
}

// ─── Types ─────────────────────────────────────────────────────────────────────
interface SetRecord {
  weight: number;
  reps: number;
  completed: boolean;
  notes?: string;
}

interface HoldRecord {
  holdId: string;
  holdName: string;
  set1: SetRecord;
  set2: SetRecord | null;
  notes?: string;
}

interface SessionRecord {
  id: string;
  startedAt: number;
  completedAt: number;
  workoutType: string;
  imported: true;
  bailed?: boolean;
  hbId?: string;
  notes?: string;
  holds: HoldRecord[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function parseWeight(s: string): number {
  return parseFloat(s);
}

function isCompleted(note: string | null | undefined): boolean {
  if (!note) return true;
  const l = note.toLowerCase();
  return !l.includes("fail") && !l.includes("bail");
}

/** Split "set1, set2" respecting brackets. */
function splitSets(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "[") depth++;
    else if (ch === "]") depth--;
    else if (ch === "," && depth === 0) { parts.push(cur); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts;
}

/** Parse a single set token like "-35 [Easy]" or "0" or "+10 [Hard]". */
function parseSet(token: string): { weight: number; note: string | undefined } {
  const m = token.trim().match(/^([+-]?\d+\.?\d*)\s*(?:\[([^\]]*)\])?/);
  if (!m) throw new Error(`Cannot parse set token: "${token}"`);
  return { weight: parseWeight(m[1]), note: m[2]?.trim() || undefined };
}

function parseHoldLine(
  line: string,
  holdKey: string,
  offset: number | null,
  isBeginner: boolean
): HoldRecord {
  const rest = line.slice(holdKey.length).trim();

  // Strip hold-level note: "# ..."
  let holdNote: string | undefined;
  let setsPart = rest;
  const hashIdx = rest.indexOf("#");
  if (hashIdx !== -1) {
    holdNote = rest.slice(hashIdx + 1).trim() || undefined;
    setsPart = rest.slice(0, hashIdx).trim();
  }

  const setTokens = splitSets(setsPart);
  const reps1 = isBeginner ? 1 : 7;
  const reps2 = isBeginner ? 1 : 6;
  const holdId = HOLD_ID[holdKey];
  const holdName = HOLD_DISPLAY[holdId];

  const s1 = setTokens[0]?.trim() ? parseSet(setTokens[0]) : null;
  const s2token = setTokens[1]?.trim();

  if (!s1) {
    // No weight at all — record as incomplete placeholder
    return { holdId, holdName, set1: { weight: 0, reps: reps1, completed: false }, set2: null, notes: holdNote };
  }

  const set1: SetRecord = {
    weight: s1.weight,
    reps: reps1,
    completed: isCompleted(s1.note),
    ...(s1.note ? { notes: s1.note } : {}),
  };

  let set2: SetRecord | null = null;
  if (s2token) {
    const s2 = parseSet(s2token);
    set2 = {
      weight: s2.weight,
      reps: reps2,
      completed: isCompleted(s2.note),
      ...(s2.note ? { notes: s2.note } : {}),
    };
  } else if (offset !== null && !isBeginner) {
    // Infer set2 weight from session offset
    set2 = { weight: s1.weight + offset, reps: reps2, completed: true };
  }

  return { holdId, holdName, set1, set2, ...(holdNote ? { notes: holdNote } : {}) };
}

// ─── Parser ────────────────────────────────────────────────────────────────────
function parse(text: string): SessionRecord[] {
  const lines = text.split("\n");
  const sessions: SessionRecord[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    // Date line starts a new session
    if (!/^\d{4}-\d{2}-\d{2}$/.test(line)) { i++; continue; }
    const date = line;
    i++;

    // Workout type line
    const wtLine = lines[i]?.trim() ?? "";
    i++;

    let workoutType = "repeaters";
    let isBeginner = false;
    let embeddedOffset: number | null = null;

    if (wtLine.toLowerCase().startsWith("beginner")) {
      workoutType = "beginner";
      isBeginner = true;
    } else {
      // Intermediate — check for embedded offset (old format: "Intermediate Offset 5 with IMR Deep")
      const offsetMatch = wtLine.match(/offset\s+(\d+\.?\d*)/i);
      if (offsetMatch) embeddedOffset = parseFloat(offsetMatch[1]);
    }

    let offset: number | null = embeddedOffset;
    let hbId: string | undefined;
    const sessionNotes: string[] = [];
    let bailed = false;
    const holds: HoldRecord[] = [];

    while (i < lines.length) {
      const l = lines[i].trim();

      if (!l) { i++; break; } // blank line = end of session

      if (/^offset\s+\d/i.test(l)) {
        offset = parseFloat(l.split(/\s+/)[1]);
        i++; continue;
      }

      if (/^HB\w*/i.test(l)) {
        hbId = l;
        i++; continue;
      }

      if (/^bailed/i.test(l)) {
        bailed = true;
        i++; continue;
      }

      const holdKey = matchHoldName(l);
      if (holdKey) {
        try {
          holds.push(parseHoldLine(l, holdKey, offset, isBeginner));
        } catch (e) {
          console.warn(`  Skipping line (parse error): "${l}": ${e}`);
        }
        i++; continue;
      }

      // Anything else is a session note
      sessionNotes.push(l);
      i++;
    }

    const startedAt = new Date(`${date}T12:00:00Z`).getTime();
    sessions.push({
      id: `import-${date}-${sessions.length + 1}`,
      startedAt,
      completedAt: startedAt,
      workoutType,
      bailed,
      imported: true,
      ...(hbId ? { hbId } : {}),
      ...(sessionNotes.length ? { notes: sessionNotes.join("\n") } : {}),
      holds,
    });
  }

  return sessions;
}

// ─── Run ───────────────────────────────────────────────────────────────────────
const inputPath = resolve(process.argv[2] ?? "hangs.hangs");
const outputPath = resolve(process.argv[3] ?? "hangs.json");

const text = readFileSync(inputPath, "utf-8");
const sessions = parse(text);
writeFileSync(outputPath, JSON.stringify(sessions, null, 2));
console.log(`Parsed ${sessions.length} sessions → ${outputPath}`);
