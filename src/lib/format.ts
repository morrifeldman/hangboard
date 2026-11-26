/** Smallest weight change the steppers make, in lb (the lightest plate pair). */
export const WEIGHT_STEP = 2.5;

/** `value + delta`, rounded so repeated 2.5 steps don't drift into values like 12.499999. */
export function stepWeight(value: number, delta: number): number {
  return Math.round((value + delta) * 10) / 10;
}

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

/** 1 → "1st", 2 → "2nd", 11 → "11th", 22 → "22nd". */
export function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n}${suffix}`;
}
