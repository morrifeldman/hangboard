import { prGlow, STONE_EDGE, STYLE_LEGEND } from "./stone";

type Props = {
  showSendsOnly: boolean;
  /** Key the round trad stone; only needed while sport and trad are mixed. */
  showTrad?: boolean;
};

export function Legend({ showSendsOnly, showTrad = false }: Props) {
  // Top rope sits with attempts: both only show when the view isn't sends-only.
  const items = showSendsOnly
    ? STYLE_LEGEND.filter((s) => s.style !== "toprope")
    : [...STYLE_LEGEND, { style: "attempt", label: "Attempt", color: "bg-gray-400" } as const];
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 px-4 py-3 text-sm border-t border-gray-800 bg-gray-900 text-gray-400">
      {items.map((s) => (
        <div key={s.style} className="flex items-center gap-2">
          <div className={`w-3.5 h-3.5 rounded-[3px] ${s.color}`} style={{ boxShadow: STONE_EDGE }} />
          <span>{s.label}</span>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <div className="w-3.5 h-3.5 rounded-[3px] bg-gray-400" style={{ boxShadow: prGlow("attempt") }} />
        <span>PR</span>
      </div>
      {showTrad && (
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded-full bg-gray-400" style={{ boxShadow: STONE_EDGE }} />
          <span>Trad</span>
        </div>
      )}
    </div>
  );
}
