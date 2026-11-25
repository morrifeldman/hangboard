import type { ClimbStyle } from "../../constants/climbGrades";
import { getStyleColor } from "../../lib/climbUtils";

// A light top edge and a dark bottom edge make each flat tile read as a stacked
// stone, which is the whole point of the pyramid being called a cairn.
export const STONE_EDGE =
  "inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(0,0,0,0.28)";

export function stoneRadius(tile: number): number {
  return Math.max(1.5, Math.round(tile / 6));
}

/**
 * Trad routes are round stones, sport routes square ones. Below this size the
 * two look alike, so small tiles stay square and the shape shows once a row is
 * expanded or the pyramid is small enough to draw full-size tiles.
 */
export const TRAD_SHAPE_MIN_TILE = 14;

/** The corner radius of a tile, round for trad once it's big enough to tell. */
export function tileRadius(tile: number, trad: boolean): number | string {
  return trad && tile >= TRAD_SHAPE_MIN_TILE ? "50%" : stoneRadius(tile);
}

export const STYLE_LEGEND = [
  { style: "onsight", label: "Onsight", color: getStyleColor("onsight") },
  { style: "flash", label: "Flash", color: getStyleColor("flash") },
  { style: "redpoint", label: "Redpoint", color: getStyleColor("redpoint") },
  { style: "toprope", label: "TR", color: getStyleColor("toprope") },
] as const;

// A soft glow in the tile's own colour marks a personal-record send.
const GLOW_RGB: Record<ClimbStyle, string> = {
  onsight: "34,197,94", // green-500
  flash: "234,179,8", // yellow-500
  redpoint: "239,68,68", // red-500
  toprope: "168,85,247", // purple-500
  attempt: "156,163,175", // gray-400
};

export function prGlow(style: ClimbStyle): string {
  const rgb = GLOW_RGB[style];
  return `0 0 0 2px #111827, 0 0 0 3.5px rgba(255,255,255,0.85), 0 0 8px 4px rgba(${rgb},0.8), 0 0 18px 6px rgba(${rgb},0.4)`;
}
