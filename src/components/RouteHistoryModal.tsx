import type { ClimbRecord } from "../lib/climbs";
import { shortLocation } from "../lib/format";

const STYLE_COLORS: Record<string, string> = {
  onsight: "bg-green-500/20 text-green-400",
  flash:   "bg-blue-500/20 text-blue-400",
  redpoint:"bg-red-500/20 text-red-400",
  attempt: "bg-gray-700 text-gray-500",
};

function formatDate(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
}

const STYLE_RANK: Record<string, number> = { onsight: 3, flash: 2, redpoint: 1, attempt: 0 };

function routeSummary(sessions: ClimbRecord[]): { label: string; style: string } {
  const best = sessions.reduce((a, b) =>
    (STYLE_RANK[b.style] ?? 0) > (STYLE_RANK[a.style] ?? 0) ? b : a
  );

  if (best.style === "onsight") return { label: "Onsight", style: "onsight" };
  if (best.style === "flash")   return { label: "Flash",   style: "flash" };

  if (best.style === "redpoint") {
    const totalAttempts = sessions.reduce((sum, c) => {
      if (c.style === "attempt")   return sum + c.climbs;
      if (c.style === "redpoint")  return sum + (c.climbs - 1);
      return sum;
    }, 0);
    const label = totalAttempts === 0
      ? "Redpoint"
      : `Redpoint after ${totalAttempts} attempt${totalAttempts !== 1 ? "s" : ""}`;
    return { label, style: "redpoint" };
  }

  const totalAttempts = sessions.reduce((sum, c) => sum + c.climbs, 0);
  const label = `${totalAttempts} attempt${totalAttempts !== 1 ? "s" : ""}, no send`;
  return { label, style: "attempt" };
}

type Props = {
  routeName: string;
  allClimbs: ClimbRecord[];
  onClose: () => void;
};

export function RouteHistoryModal({ routeName, allClimbs, onClose }: Props) {
  const sessions = allClimbs
    .filter((c) => c.route === routeName)
    .sort((a, b) => b.date.localeCompare(a.date));

  if (sessions.length === 0) return null;

  const location = shortLocation(sessions[0].location);
  const summary = routeSummary(sessions);

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[70]" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900 rounded-t-2xl z-[70] max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between px-4 py-4 border-b border-gray-800 sticky top-0 bg-gray-900">
          <div className="min-w-0 flex-1">
            <h2 className="text-white font-semibold">{routeName}</h2>
            {location && (
              <p className="text-gray-500 text-xs mt-0.5">{location}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-white p-1 -mr-1 ml-3 flex-shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Overall summary */}
        <div className="px-4 py-3 border-b border-gray-800">
          <span className={`text-sm font-medium px-2 py-1 rounded ${STYLE_COLORS[summary.style] ?? STYLE_COLORS.attempt}`}>
            {summary.label}
          </span>
        </div>

        {/* Sessions list */}
        <div className="px-4 py-3 flex flex-col gap-3">
          <p className="text-xs uppercase tracking-wider text-gray-500">
            {sessions.length} session{sessions.length !== 1 ? "s" : ""}
          </p>
          {sessions.map((c) => {
            const falls = c.style === "redpoint" ? c.climbs - 1 : 0;
            const styleLabel =
              c.style === "attempt"   ? (c.climbs > 1 ? `${c.climbs} attempts` : "attempt") :
              c.style === "redpoint"  ? (falls > 0 ? `${falls} attempt${falls !== 1 ? "s" : ""} · send` : "redpoint") :
              c.style;
            return (
              <div key={c.id} className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-gray-300 text-sm flex-1">{formatDate(c.date)}</span>
                  <span className="text-gray-500 text-xs font-mono">{c.grade}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${STYLE_COLORS[c.style] ?? STYLE_COLORS.attempt}`}>
                    {styleLabel}
                  </span>
                </div>
                {c.notes && (
                  <p className="text-gray-500 text-xs italic pl-0.5">"{c.notes}"</p>
                )}
              </div>
            );
          })}
        </div>

        <div className="h-8" />
      </div>
    </>
  );
}
