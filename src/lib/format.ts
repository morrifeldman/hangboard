export function formatWeight(n: number): string {
  if (n === 0) return "BW";
  if (n > 0) return `+${n}`;
  return `${n}`;
}

export function formatOffset(n: number): string {
  if (n === 0) return "0";
  if (n > 0) return `+${n}`;
  return `${n}`;
}

/** Returns the last segment of a ">" separated location string, stripping leading order numbers like "(5) ". */
export function shortLocation(location: string): string {
  const parts = location.split(">").map((p) => p.trim().replace(/^\(\d+\)\s*/, ""));
  return parts[parts.length - 1] || location;
}
