import type { WeightDirection } from "../lib/weightCues";

/** The hangboard "next time" cue's arrow and colours, for one lift's next base. */
export function NextArrow({ dir }: { dir: WeightDirection | null }) {
  if (dir === "up") return <span className="font-num text-green-400"> ↑</span>;
  if (dir === "down") return <span className="font-num text-red-400"> ↓</span>;
  if (dir === "mixed") return <span className="font-num text-yellow-400"> ↑↓</span>;
  return null;
}
