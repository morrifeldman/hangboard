import { todayDateString } from "./dates";
import { normalizeGrade } from "./climbGradeUtils";
import type { ClimbRecord } from "./climbs";
import type { ClimbStyle } from "../constants/climbGrades";

/** Parse the Mountain Project Pitches column as total attempt count. */
export function parsePitches(value: string | undefined): number {
  if (!value) return 1;
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** Convert Mountain Project lead style to our ClimbStyle. */
export function convertStyle(leadStyle: string | undefined): ClimbStyle {
  switch (leadStyle) {
    case "Onsight":  return "onsight";
    case "Flash":    return "flash";
    case "Redpoint": return "redpoint";
    case "Fell/Hung":
    default:         return "attempt";
  }
}

/** Detect indoor gym from location string (whole words, so "Gymnasium Rock" is not a gym). */
export function isIndoor(location: string | undefined): boolean {
  if (!location) return false;
  return /\b(?:gym|indoor)\b/i.test(location);
}

/** Convert YYYY-MM-DD, M/D/YYYY or an ISO datetime to YYYY-MM-DD; null if unrecognised. */
function parseDate(value: string | undefined): string | null {
  const v = value?.trim();
  if (!v) return null;
  const pad = (n: string) => n.padStart(2, "0");
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const us = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) return `${us[3]}-${pad(us[1])}-${pad(us[2])}`;
  return null;
}

/** RFC-4180 parser over the whole text: quoted fields, "" escapes, embedded commas/newlines, CRLF/LF. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const endRow = () => {
    row.push(field);
    field = "";
    // Skip fully blank lines (including the one after a trailing newline).
    if (row.length > 1 || row[0].trim() !== "") rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      endRow();
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) endRow();
  return rows;
}

/** Parse the CSV and return trimmed header names plus the data rows. */
function readTable(csvText: string): { headers: string[]; rows: string[][] } {
  const [head = [], ...rows] = parseCsv(csvText.replace(/^\uFEFF/, ""));
  return { headers: head.map((h) => h.trim()), rows };
}

/**
 * True when `csvText` starts with something that really looks like a Mountain
 * Project tick export: a header row naming at least the Route and Rating
 * columns the importer reads.
 *
 * This is the gate that stops an HTML error page, or a JavaScript file, from
 * being parsed as "a CSV with zero climbs in it" and wiping the climb log.
 */
export function hasMountainProjectHeaders(csvText: string): boolean {
  const { headers } = readTable(csvText);
  return headers.includes("Route") && headers.includes("Rating");
}

/** Parse Mountain Project CSV text and return ClimbRecords. */
export function parseMountainProjectCSV(csvContent: string): ClimbRecord[] {
  const { headers, rows } = readTable(csvContent);
  const climbs: ClimbRecord[] = [];

  for (const values of rows) {
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = (values[idx] ?? "").trim();
    });

    if (!row.Route || !row.Rating) continue;
    const grade = normalizeGrade(row.Rating);
    if (!grade) continue;

    climbs.push({
      id: crypto.randomUUID(),
      route: row.Route,
      grade,
      location: row.Location || "",
      type: row["Route Type"] === "Boulder" ? "boulder" : "sport",
      setting: isIndoor(row.Location) ? "indoor" : "outdoor",
      style: convertStyle(row["Lead Style"]),
      climbs: parsePitches(row.Pitches),
      date: parseDate(row.Date) ?? todayDateString(),
      notes: row.Notes || "",
    });
  }

  return climbs;
}

/** Import a Mountain Project CSV file and return ClimbRecords. */
export async function importMountainProjectCSV(file: File): Promise<ClimbRecord[]> {
  return parseMountainProjectCSV(await file.text());
}
