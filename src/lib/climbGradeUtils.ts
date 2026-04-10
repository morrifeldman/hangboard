/** Normalize a climbing grade to the standard letter format (e.g. 5.12b). */
export function normalizeGrade(grade: string | null | undefined): string | null {
  if (!grade) return null;
  const g = grade.toString();

  // Slash grades: "5.12a/b" → "5.12b"
  if (g.includes("/")) {
    const parts = g.split("/");
    const last = parts[parts.length - 1];
    if (last.length === 1 && /[a-d]/.test(last)) {
      const match = parts[0].match(/(\d+\.\d+)/);
      if (match) return `${match[1]}${last}`;
    }
    return last;
  }

  // Plus modifier: "5.10+" → "5.10d"
  if (g.includes("+")) {
    const base = g.replace("+", "");
    const match = base.match(/(\d+\.\d+)([a-d]?)/);
    if (match) {
      const [, num, letter] = match;
      if (!letter) return `${num}d`;
    }
    return g;
  }

  // Minus modifier: "5.11-" → "5.11a"
  if (g.includes("-")) {
    const base = g.replace("-", "");
    const match = base.match(/(\d+\.\d+)/);
    if (match) return `${match[1]}a`;
  }

  return g;
}
