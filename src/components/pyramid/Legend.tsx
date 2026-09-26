import { STONE_EDGE, STYLE_LEGEND } from "./stone";

type Props = { showSendsOnly: boolean };

export function Legend({ showSendsOnly }: Props) {
  const items = showSendsOnly
    ? STYLE_LEGEND
    : [...STYLE_LEGEND, { style: "attempt", label: "Attempt", color: "bg-gray-400" } as const];
  return (
    <div className="flex justify-center gap-5 px-4 py-3 text-sm border-t border-gray-800 bg-gray-900 text-gray-400">
      {items.map((s) => (
        <div key={s.style} className="flex items-center gap-2">
          <div className={`w-3.5 h-3.5 rounded-[3px] ${s.color}`} style={{ boxShadow: STONE_EDGE }} />
          <span>{s.label}</span>
        </div>
      ))}
    </div>
  );
}
