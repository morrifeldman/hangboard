/** Trailing protection ratings Mountain Project appends: "5.10a PG13", "5.10b R", "V5 PG13". */
const PROTECTION_RE = /\s+(?:PG13|PG|R|X)$/i;

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
 * protection ratings are dropped. Unrecognised input is returned trimmed.
 */
export function normalizeGrade(grade: string | null | undefined): string | null {
  if (!grade) return null;
  const trimmed = grade.toString().trim();
  if (!trimmed) return null;
  const g = trimmed.replace(PROTECTION_RE, "");

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
