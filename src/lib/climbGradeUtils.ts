/**
 * What can trail a rock grade on Mountain Project: a protection rating (PG13,
 * R, X), an aid grade (A0, C2+), or an ice, mixed or snow grade on an alpine
 * route ("5.8 WI3", "5.9 M5", "5.6 Mod. Snow"). Stripped one at a time from the
 * end, so "5.9 A1 R" becomes "5.9".
 */
const SUFFIX_RE = /\s+(?:PG13|PG|R|X|[AC]\d[+-]?|A?WI\d[+-]?|AI\d[+-]?|M\d+[+-]?|(?:Easy|Mod\.?|Steep)\s+Snow|Snow)$/i;

function stripSuffixes(grade: string): string {
  let g = grade;
  for (let prev = ""; prev !== g; ) {
    prev = g;
    g = g.replace(SUFFIX_RE, "");
  }
  return g;
}

const LETTERS = "abcd";

/**
 * Bare 5.10-5.13 (no letter, no +/-) map to the middle "b" grade: "5.11" is
 * neither clearly easy nor hard for its number, and "b" keeps it inside the band.
 */
const BARE_LETTER = "b";

type Yds = { num: number; letter: number };

/** Rank a YDS grade so slash grades can pick the harder side. */
function ydsRank(g: Yds): number {
  return g.num * 10 + g.letter;
}

/**
 * Parse one slash-separated YDS part. `prevNum` lets "5.12a/b" and "5.10d/11a"
 * inherit or override the number from the part before.
 */
function parseYdsPart(part: string, prevNum: number | null): Yds | null {
  const m = part.match(/^(?:5\.)?(\d+)?\s*([a-d])?([+-])?$/i);
  if (!m) return null;
  const [, numStr, letterStr, mod] = m;
  const num = numStr ? parseInt(numStr, 10) : prevNum;
  if (num === null || (!numStr && !letterStr)) return null;
  if (num < 10) return { num, letter: 0 };
  if (letterStr) return { num, letter: LETTERS.indexOf(letterStr.toLowerCase()) };
  if (mod === "+") return { num, letter: 3 };
  if (mod === "-") return { num, letter: 0 };
  return { num, letter: LETTERS.indexOf(BARE_LETTER) };
}

function formatYds({ num, letter }: Yds): string {
  return num < 10 ? `5.${num}` : `5.${num}${LETTERS[letter]}`;
}

/**
 * Normalize a climbing grade to the app's standard form (e.g. 5.12b, V4).
 * Slash/range grades take the harder side, +/- map to d/a for 5.10+, and
 * protection ratings and aid, ice, mixed or snow grades are dropped. Unrecognised input is returned trimmed.
 */
export function normalizeGrade(grade: string | null | undefined): string | null {
  if (!grade) return null;
  const trimmed = grade.toString().trim();
  if (!trimmed) return null;
  const g = stripSuffixes(trimmed);

  // Bouldering: VB, V-easy, V3, V3+, V3/4, V3-4
  if (/^V(?:B|-?easy)$/i.test(g)) return "VB";
  const v = g.match(/^V(\d+)(?:\s*[/-]\s*V?(\d+))?[+-]?$/i);
  if (v) return `V${Math.max(parseInt(v[1], 10), v[2] ? parseInt(v[2], 10) : 0)}`;

  // YDS: 5.10a, 5.12a/b, 5.10d/11a, 5.10+, 5.9-, "5.10 b"
  if (/^5\./.test(g)) {
    let best: Yds | null = null;
    let prevNum: number | null = null;
    for (const raw of g.split("/")) {
      const parsed = parseYdsPart(raw.trim(), prevNum);
      if (!parsed) return trimmed;
      prevNum = parsed.num;
      if (!best || ydsRank(parsed) > ydsRank(best)) best = parsed;
    }
    return best ? formatYds(best) : trimmed;
  }

  return trimmed;
}

/**
 * Approximate French sport grade for each rung of the YDS ladder. Where a YDS
 * grade falls between two French grades it shows both ("6c/6c+"). Display
 * only: grades are always stored as YDS.
 */
const YDS_TO_FRENCH: Record<string, string> = {
  "5.0": "1", "5.1": "2", "5.2": "2+", "5.3": "3", "5.4": "3+", "5.5": "4a",
  "5.6": "4b", "5.7": "4c/5a", "5.8": "5b", "5.9": "5c",
  "5.10a": "6a", "5.10b": "6a+", "5.10c": "6b", "5.10d": "6b+",
  "5.11a": "6c", "5.11b": "6c/6c+", "5.11c": "6c+", "5.11d": "7a",
  "5.12a": "7a+", "5.12b": "7b", "5.12c": "7b+", "5.12d": "7c",
  "5.13a": "7c+", "5.13b": "8a", "5.13c": "8a+", "5.13d": "8b",
  "5.14a": "8b+", "5.14b": "8c", "5.14c": "8c+", "5.14d": "9a",
  "5.15a": "9a+", "5.15b": "9b", "5.15c": "9b+", "5.15d": "9c",
};

/** The French equivalent of a normalized YDS grade, or null for anything else (V grades, unparsed text). */
export function frenchGrade(yds: string): string | null {
  return YDS_TO_FRENCH[yds] ?? null;
}
