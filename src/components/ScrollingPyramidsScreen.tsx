import { useEffect, useMemo, useState } from "react";
import { Mountain, Home, ArrowDownNarrowWide, ArrowUpNarrowWide, BarChart2 } from "lucide-react";
import { getClimbs } from "../lib/climbs";
import type { ClimbRecord } from "../lib/climbs";
import { generateWindows, filterClimbsByWindow } from "../lib/pyramidData";
import type { SeasonWindow, WindowKind } from "../lib/pyramidData";
import { getStyleColor, getFilteredClimbs } from "../lib/climbUtils";
import { deduplicateForPyramid } from "../lib/deduplication";
import { SPORT_GRADES, VIEWS } from "../constants/climbGrades";
import type { ViewKey } from "../constants/climbGrades";
import { RouteHistoryModal } from "./RouteHistoryModal";

type Props = { onBack: () => void };

const SPORT_VIEWS = VIEWS.filter((v) => v.type === "sport");

const KINDS: { key: WindowKind; label: string }[] = [
  { key: "seasons", label: "Seasons" },
  { key: "years", label: "Years" },
  { key: "halves-fw-ss", label: "Fall+Winter / Spring+Summer" },
  { key: "halves-ws-sf", label: "Winter+Spring / Summer+Fall" },
];

export function ScrollingPyramidsScreen({ onBack }: Props) {
  const [climbs, setClimbs] = useState<ClimbRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewKey>("outdoor-sport");
  const [kind, setKind] = useState<WindowKind>("seasons");
  const [newestFirst, setNewestFirst] = useState(true);
  const [showCounts, setShowCounts] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);

  useEffect(() => {
    getClimbs().then((c) => {
      setClimbs(c);
      setLoading(false);
    });
  }, []);

  // Filter by view + sends-only. Dedup happens per-window inside SeasonCard so
  // a route re-sent in a later season still counts in its original season too.
  const viewSends = useMemo(
    () => getFilteredClimbs(climbs, view, true, [0, 100]).filter((c) => c.style !== "attempt"),
    [climbs, view],
  );

  const gradesToShow = useMemo(() => computeGradeRange(viewSends), [viewSends]);

  const windows = useMemo(() => {
    const ws = generateWindows(viewSends, kind);
    return newestFirst ? ws : [...ws].reverse();
  }, [viewSends, kind, newestFirst]);

  return (
    <div className="h-dvh bg-gray-900 flex flex-col overflow-hidden">
      <header className="bg-gray-800 px-4 py-4 flex items-center gap-3">
        <button
          onClick={onBack}
          aria-label="Back"
          className="text-gray-400 hover:text-white transition-colors p-1 -ml-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="text-white font-bold text-xl">Scrolling Pyramids</h1>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowCounts((v) => !v)}
            className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md transition-colors ${
              showCounts
                ? "bg-indigo-600 text-white"
                : "bg-gray-700/60 text-gray-300 hover:bg-gray-700 hover:text-white"
            }`}
            title="Toggle per-grade counts and cumulative bars"
            aria-pressed={showCounts}
          >
            <BarChart2 size={14} />
            Counts
          </button>
          <button
            onClick={() => setNewestFirst((v) => !v)}
            className="flex items-center gap-1.5 text-gray-300 hover:text-white text-xs font-medium px-2.5 py-1.5 rounded-md bg-gray-700/60 hover:bg-gray-700 transition-colors"
            title={newestFirst ? "Newest first — tap to reverse" : "Oldest first — tap to reverse"}
          >
            {newestFirst ? <ArrowDownNarrowWide size={14} /> : <ArrowUpNarrowWide size={14} />}
            {newestFirst ? "Newest" : "Oldest"}
          </button>
        </div>
      </header>

      <div className="border-b border-gray-700 px-2">
        <div className="flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {SPORT_VIEWS.map((v) => {
            const Icon = v.setting === "outdoor" ? Mountain : Home;
            return (
              <button
                key={v.key}
                onClick={() => setView(v.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 border-b-2 whitespace-nowrap text-sm transition-colors ${
                  view === v.key
                    ? "border-green-500 text-green-400 bg-green-500/10"
                    : "border-transparent text-gray-400 hover:text-white"
                }`}
              >
                <Icon size={16} />
                {v.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 py-3 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {KINDS.map((k) => (
          <button
            key={k.key}
            onClick={() => setKind(k.key)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
              kind === k.key
                ? "bg-indigo-600 text-white"
                : "bg-gray-800 text-gray-400"
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-500 text-sm">Loading…</div>
        </div>
      ) : windows.length === 0 ? (
        <div className="flex-1 flex items-center justify-center px-8 text-center">
          <p className="text-gray-500 text-sm">No climbs logged for this view yet.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
          {windows.map((w) => (
            <SeasonCard
              key={w.id}
              window={w}
              climbs={viewSends}
              gradesToShow={gradesToShow}
              showCounts={showCounts}
              onClimbClick={(c) => setSelectedRoute(c.route)}
            />
          ))}
          <div className="h-4" />
        </div>
      )}

      {selectedRoute && (
        <RouteHistoryModal
          routeName={selectedRoute}
          allClimbs={climbs}
          onClose={() => setSelectedRoute(null)}
        />
      )}
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function SeasonCard({
  window,
  climbs,
  gradesToShow,
  showCounts,
  onClimbClick,
}: {
  window: SeasonWindow;
  climbs: ClimbRecord[];
  gradesToShow: readonly string[];
  showCounts: boolean;
  onClimbClick: (c: ClimbRecord) => void;
}) {
  const windowClimbs = useMemo(
    () => deduplicateForPyramid(filterClimbsByWindow(climbs, window)),
    [climbs, window],
  );
  const rows = useMemo(
    () => buildRowsForRange(windowClimbs, gradesToShow),
    [windowClimbs, gradesToShow],
  );
  const total = rows.reduce((sum, r) => sum + r.climbs.length, 0);

  return (
    <div className="bg-gray-800 rounded-xl px-4 py-3">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-white font-semibold">{window.label}</h2>
        <span className="text-gray-400 text-xs">
          {total} send{total === 1 ? "" : "s"}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="text-gray-500 text-sm py-4 text-center">No sends in this period</p>
      ) : (
        <PyramidBody rows={rows} showCounts={showCounts} onClimbClick={onClimbClick} />
      )}
    </div>
  );
}

// ─── Pyramid body ─────────────────────────────────────────────────────────────

type Row = { grade: string; climbs: ClimbRecord[] };

function PyramidBody({
  rows,
  showCounts,
  onClimbClick,
}: {
  rows: Row[];
  showCounts: boolean;
  onClimbClick: (c: ClimbRecord) => void;
}) {
  const maxClimbs = Math.max(...rows.map((r) => r.climbs.length), 1);
  const cumulatives = useMemo(() => {
    let running = 0;
    return rows.map((r) => (running += r.climbs.length));
  }, [rows]);
  const maxCum = cumulatives[cumulatives.length - 1] || 1;
  return (
    <div className="relative">
      <div className={`absolute left-0 top-0 z-10 bg-gray-800 ${showCounts ? "w-32" : "w-14"}`}>
        <div className="space-y-1">
          {rows.map((r, i) => (
            <div
              key={r.grade}
              className={`h-6 grid items-center pl-1 pr-1 gap-1 ${
                showCounts
                  ? "grid-cols-[2.5rem_1.25rem_28px_auto]"
                  : "grid-cols-[2.5rem]"
              }`}
            >
              <span className="text-xs font-medium text-gray-400 tabular-nums">{r.grade}</span>
              {showCounts && (
                <>
                  <span className="text-[10px] text-gray-500 tabular-nums">
                    {r.climbs.length > 0 ? `[${r.climbs.length}]` : ""}
                  </span>
                  <div
                    className="h-1.5 bg-indigo-500/60 rounded-sm justify-self-end"
                    style={{ width: `${(cumulatives[i] / maxCum) * 24}px` }}
                  />
                  <span className="text-[10px] text-indigo-400/80 tabular-nums italic">
                    {cumulatives[i] > 0 ? `(${cumulatives[i]})` : ""}
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className={`overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${showCounts ? "pl-32" : "pl-14"}`}>
        <div style={{ minWidth: `${maxClimbs * 26 + 16}px` }}>
          <div className="space-y-1">
            {rows.map((r) => (
              <div key={r.grade} className="flex items-center h-6">
                <div className="flex-1 flex justify-center">
                  <div className="flex gap-1">
                    {r.climbs.map((climb, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => onClimbClick(climb)}
                        className={`w-5 h-5 rounded ${getStyleColor(climb.style)} hover:scale-110 transition-transform cursor-pointer`}
                        title={`${climb.route} — ${climb.style}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeGradeRange(climbs: ClimbRecord[]): readonly string[] {
  const used = new Set(climbs.map((c) => c.grade));
  const indices: number[] = [];
  for (let i = 0; i < SPORT_GRADES.length; i++) {
    if (used.has(SPORT_GRADES[i])) indices.push(i);
  }
  if (indices.length === 0) return [];
  return SPORT_GRADES.slice(indices[0], indices[indices.length - 1] + 1);
}

function buildRowsForRange(
  climbs: ClimbRecord[],
  gradesToShow: readonly string[],
): Row[] {
  const map: Record<string, ClimbRecord[]> = {};
  for (const g of gradesToShow) map[g] = [];
  for (const c of climbs) {
    if (map[c.grade]) map[c.grade].push(c);
  }
  return [...gradesToShow].reverse().map((g) => ({ grade: g, climbs: map[g] }));
}
