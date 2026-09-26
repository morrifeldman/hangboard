// A light top edge and a dark bottom edge make each flat tile read as a stacked
// stone, which is the whole point of the pyramid being called a cairn.
export const STONE_EDGE =
  "inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(0,0,0,0.28)";

export function stoneRadius(tile: number): number {
  return Math.max(1.5, Math.round(tile / 6));
}

export const STYLE_LEGEND = [
  { style: "onsight", label: "Onsight", color: "bg-green-500" },
  { style: "flash", label: "Flash", color: "bg-yellow-500" },
  { style: "redpoint", label: "Redpoint", color: "bg-red-500" },
] as const;
