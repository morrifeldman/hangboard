import { useEffect, useMemo, useState } from "react";
import { ArrowDownNarrowWide, ArrowUpNarrowWide, BarChart2, CalendarDays, Layers, Repeat, Trophy } from "lucide-react";
import { getClimbs } from "../lib/climbs";
import type { ClimbRecord } from "../lib/climbs";
import { generateWindows, filterClimbsByWindow } from "../lib/pyramidData";
import type { SeasonWindow, WindowKind } from "../lib/pyramidData";
import { getFilteredClimbs } from "../lib/climbUtils";
import type { PyramidRow } from "../lib/climbUtils";
import { deduplicateForPyramid } from "../lib/deduplication";
import { SPORT_GRADES } from "../constants/climbGrades";
import type { ViewKey } from "../constants/climbGrades";
import { RouteHistoryModal } from "./RouteHistoryModal";
import { BackChevronIcon } from "./icons";
import { PyramidBody } from "./pyramid/PyramidBody";

type Props = { onBack: () => void };

const KINDS: { key: WindowKind; label: string }[] = [
  { key: "seasons", label: "Seasons" },
  { key: "years", label: "Years" },
  { key: "halves-fw-ss", label: "Fall+Winter / Spring+Summer" },
  { key: "halves-ws-sf", label: "Winter+Spring / Summer+Fall" },
];

export function ScrollingPyramidsScreen({ onBack }: Props) {
  const [climbs, setClimbs] = useState<ClimbRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const view: ViewKey = "outdoor-sport";
  const [kind, setKind] = useState<WindowKind>("seasons");
  const [newestFirst, setNewestFirst] = useState(true);
  const [showCounts, setShowCounts] = useState(false);
  const [showSessionCounts, setShowSessionCounts] = useState(false);
  const [showSendsOnly, setShowSendsOnly] = useState(true);
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);

  useEffect(() => {
    getClimbs().then((c) => {
      setClimbs(c);
      setLoading(false);
    });
  }, []);

  // viewClimbs is always the per-window dedup pool so attempt records can
  // sum into the eventual send's climb count (matches main pyramid order:
  // dedup first → drop attempt-style after). The "window source" — what
  // decides which seasons get cards and which grades to show — is sends-only
  // when the toggle is on (skip seasons where the user only ever bailed) and
  // all climbs when the toggle is off (show project-only seasons too).
  const viewClimbs = useMemo(
    () => getFilteredClimbs(climbs, view, false, [0, 100]),
    [climbs, view],
  );
  const viewSends = useMemo(
    () => viewClimbs.filter((c) => c.style !== "attempt"),
    [viewClimbs],
  );
  const windowSource = showSendsOnly ? viewSends : viewClimbs;

  const gradesToShow = useMemo(() => computeGradeRange(windowSource), [windowSource]);

  const windows = useMemo(() => {
    const ws = generateWindows(windowSource, kind);
    return newestFirst ? ws : [...ws].reverse();
  }, [windowSource, kind, newestFirst]);

  return (
    <div className="h-dvh bg-gray-900 flex flex-col overflow-hidden">
      <header className="bg-gray-800 px-4 py-4 flex items-center gap-3">
        <button
          onClick={onBack}
          aria-label="Back"
          className="text-gray-400 hover:text-white transition-colors p-1 -ml-1"
        >
          <BackChevronIcon />
        </button>
        <Layers size={24} className="text-white" aria-label="Scrolling Pyramids" />
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowSendsOnly((v) => !v)}
            className={`flex items-center px-2 py-1.5 rounded-md transition-colors ${
              showSendsOnly
                ? "bg-indigo-600 text-white"
                : "bg-gray-700/60 text-gray-300 hover:bg-gray-700 hover:text-white"
            }`}
            title={showSendsOnly ? "Sends only — tap to include attempts" : "Showing all — tap to filter to sends only"}
            aria-pressed={showSendsOnly}
            aria-label="Toggle sends only"
          >
            <Trophy size={16} />
          </button>
          <button
            onClick={() => setShowCounts((v) => !v)}
            className={`flex items-center px-2 py-1.5 rounded-md transition-colors ${
              showCounts
                ? "bg-indigo-600 text-white"
                : "bg-gray-700/60 text-gray-300 hover:bg-gray-700 hover:text-white"
            }`}
            title="Toggle per-grade counts and cumulative bars"
            aria-pressed={showCounts}
            aria-label="Toggle counts"
          >
            <BarChart2 size={16} />
          </button>
          <button
            onClick={() => setShowSessionCounts((v) => !v)}
            className={`flex items-center px-2 py-1.5 rounded-md transition-colors ${
              showSessionCounts
                ? "bg-indigo-600 text-white"
                : "bg-gray-700/60 text-gray-300 hover:bg-gray-700 hover:text-white"
            }`}
            title={
              showSessionCounts
                ? "Tile numbers show sessions — tap to show climb counts"
                : "Tile numbers show climbs — tap to show session counts"
            }
            aria-pressed={showSessionCounts}
            aria-label="Toggle session vs climb counts"
          >
            {showSessionCounts ? <CalendarDays size={16} /> : <Repeat size={16} />}
          </button>
          <button
            onClick={() => setNewestFirst((v) => !v)}
            className="flex items-center px-2 py-1.5 rounded-md bg-gray-700/60 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
            title={newestFirst ? "Newest first — tap to reverse" : "Oldest first — tap to reverse"}
            aria-label={newestFirst ? "Sort: newest first" : "Sort: oldest first"}
          >
            {newestFirst ? <ArrowDownNarrowWide size={16} /> : <ArrowUpNarrowWide size={16} />}
          </button>
        </div>
      </header>

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
              climbs={viewClimbs}
              gradesToShow={gradesToShow}
              showCounts={showCounts}
              showSessionCounts={showSessionCounts}
              showSendsOnly={showSendsOnly}
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
  showSessionCounts,
  showSendsOnly,
  onClimbClick,
}: {
  window: SeasonWindow;
  climbs: ClimbRecord[];
  gradesToShow: readonly string[];
  showCounts: boolean;
  showSessionCounts: boolean;
  showSendsOnly: boolean;
  onClimbClick: (c: ClimbRecord) => void;
}) {
  // Dedup includes attempts so their climb counts roll into the send record;
  // when sends-only is on, drop pure-attempt routes (never sent in this window).
  const windowClimbs = useMemo(() => {
    const deduped = deduplicateForPyramid(filterClimbsByWindow(climbs, window));
    return showSendsOnly ? deduped.filter((c) => c.style !== "attempt") : deduped;
  }, [climbs, window, showSendsOnly]);
  const rows = useMemo(
    () => buildRowsForRange(windowClimbs, gradesToShow),
    [windowClimbs, gradesToShow],
  );
  const total = rows.reduce((sum, r) => sum + r.climbs.length, 0);
  const totalLabel = showSendsOnly ? "send" : "climb";

  return (
    <div className="bg-gray-800 rounded-xl px-4 py-3">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-white font-semibold">{window.label}</h2>
        <span className="text-gray-400 text-xs">
          {total} {totalLabel}{total === 1 ? "" : "s"}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="text-gray-500 text-sm py-4 text-center">
          No {showSendsOnly ? "sends" : "climbs"} in this period
        </p>
      ) : (
        <PyramidBody
          rows={rows}
          showCounts={showCounts}
          showSessionCounts={showSessionCounts}
          onClimbClick={onClimbClick}
          gutterBgClass="bg-gray-800"
        />
      )}
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
): PyramidRow[] {
  const map: Record<string, ClimbRecord[]> = {};
  for (const g of gradesToShow) map[g] = [];
  for (const c of climbs) {
    if (map[c.grade]) map[c.grade].push(c);
  }
  return [...gradesToShow].reverse().map((g) => ({
    grade: g,
    climbs: map[g].slice().sort((a, b) => a.date.localeCompare(b.date)),
  }));
}
