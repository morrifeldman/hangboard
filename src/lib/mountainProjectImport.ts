import { normalizeGrade } from "./climbGradeUtils";
import type { ClimbRecord } from "./climbs";
import type { ClimbStyle } from "../constants/climbGrades";

const WORD_NUMBERS: Record<string, number> = {
  one: 1, first: 1, two: 2, second: 2, three: 3, third: 3,
  four: 4, fourth: 4, five: 5, fifth: 5, six: 6, seventh: 7,
  eight: 8, nine: 9, ten: 10,
};
const KEYWORDS = "attempt|tries?|try|go|burn";

/** Extract attempt count from Mountain Project notes field. */
export function extractAttempts(notes: string | undefined): number {
  if (!notes) return 1;
  // "3rd try", "2nd go", "5th attempt" — ordinal = total attempts
  const ord = notes.match(/(\d+)(?:st|nd|rd|th)\s+(?:try|go|attempt|burn)/i);
  if (ord) return parseInt(ord[1], 10);
  // "3 attempts", "2 tries", "1 burn" — with optional punctuation between number and keyword
  const m = notes.match(new RegExp(`(\\d+)\\s*\\S?\\s*(?:${KEYWORDS})`, "i"));
  if (m) return parseInt(m[1], 10);
  // "10 or so attempts"
  const m2 = notes.match(new RegExp(`(\\d+)\\s*or\\s*so\\s*(?:${KEYWORDS})`, "i"));
  if (m2) return parseInt(m2[1], 10);
  // Word ordinals: "second attempt", "first go", "third try"
  const wordOrd = notes.match(new RegExp(`(first|second|third|fourth|fifth)\\s+(?:${KEYWORDS})`, "i"));
  if (wordOrd) return WORD_NUMBERS[wordOrd[1].toLowerCase()] ?? 1;
  const wordNum = notes.match(new RegExp(`(one|two|three|four|five|six|seven|eight|nine|ten)\\s+(?:${KEYWORDS})`, "i"));
  if (wordNum) return WORD_NUMBERS[wordNum[1].toLowerCase()] ?? 1;
  return 1;
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
        climbs: extractAttempts(row.Notes),
        date: row.Date || new Date().toISOString().split("T")[0],
        notes: row.Notes || "",
      });
    }
  }

  // A redpoint with climbs=1 and no other ticks for that route implies at least one prior failure
  const routeTickCount: Record<string, number> = {};
  for (const c of climbs) {
    const key = `${c.route}-${c.location}`;
    routeTickCount[key] = (routeTickCount[key] ?? 0) + 1;
  }
  for (const c of climbs) {
    if (c.style === "redpoint" && c.climbs === 1 && routeTickCount[`${c.route}-${c.location}`] === 1) {
      c.climbs = 2;
    }
  }

  return climbs;
}
