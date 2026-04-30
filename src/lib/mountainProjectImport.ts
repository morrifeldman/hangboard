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

/** Detect indoor gym from location string. */
export function isIndoor(location: string | undefined): boolean {
  if (!location) return false;
  const keywords = ["gym", "climbing gym", "indoor", "bouldering gym"];
  const lower = location.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

/** Parse a CSV row respecting quoted fields. */
function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  values.push(current.trim());
  return values;
}

/** Import a Mountain Project CSV file and return ClimbRecords. */
export async function importMountainProjectCSV(file: File): Promise<ClimbRecord[]> {
  const csvContent = await file.text();
  const lines = csvContent.split("\n");
  const headers = lines[0].split(",").map((h) => h.replace(/"/g, "").trim());

  const climbs: ClimbRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const values = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || "";
    });

    if (row.Route && row.Rating) {
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
        date: row.Date || new Date().toISOString().split("T")[0],
        notes: row.Notes || "",
      });
    }
  }

  return climbs;
}
