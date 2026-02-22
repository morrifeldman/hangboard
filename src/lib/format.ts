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
