import { useHistoryData } from "../hooks/useLoad";
import { Fragment, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { SessionRecord, GymData } from "../lib/history";
import type { ClimbRecord } from "../lib/climbs";
import type { NoteRecord } from "../lib/notes";
import { SPORT_GRADES, BOULDER_GRADES } from "../constants/climbGrades";
import { sessionNextSummary } from "../lib/weightCues";
import { NextArrow } from "./NextArrow";
import { sessionPRs } from "../lib/personalRecords";
import { gymSummaryParts, type SummaryPart } from "../lib/sessionSummary";
import {
  workoutLabel,
  workoutTypeLabel,
  workoutTypeGroups,
  normalizeQuery,
  sessionMatchesQuery,
  climbMatchesQuery,
  noteMatchesQuery,
} from "../lib/historyFilter";
import { shortLocation } from "../lib/format";
import { dateKeyToTime, startOfWeek, toLocalDateString } from "../lib/dates";
import { withCurrentLiftNames } from "../lib/lifts";
import { useWorkoutStore } from "../store/useWorkoutStore";
import { RouteHistoryModal } from "./RouteHistoryModal";
import { PRBadge } from "./PRBadge";
import { GearIcon, NoteIcon } from "./icons";
import { useScrollRestore } from "../hooks/useScrollRestore";

/** The parts of the timeline view that live in the URL, so they survive a
 *  drill-in, a reload, and a back press. */
export type HistoryView = {
  filter: TimelineFilter;
  query: string;
  tags: string[];
  types: string[];
};

type Props = {
  view: HistoryView;
  onViewChange: (patch: Partial<HistoryView>) => void;
  onAddNote: () => void;
  onEdit: (record: SessionRecord) => void;
  onEditNote: (note: NoteRecord) => void;
  onShowSettings: () => void;
};

type TimelineFilter = "all" | "workouts" | "climbs" | "notes";

// ─── Small pieces ─────────────────────────────────────────────────────────────

/** A figure that is the content of a summary line, as opposed to its units. */
function Fig({ children }: { children: ReactNode }) {
  return <span className="font-num text-gray-200">{children}</span>;
}

function joinDots(parts: ReactNode[]): ReactNode {
  return parts.map((p, i) => (
    <Fragment key={i}>
      {i > 0 && " · "}
      {p}
    </Fragment>
  ));
}

const CHIP_TONES = {
  neutral: "bg-gray-700 text-gray-200",
  orange:  "bg-orange-500/15 text-orange-300",
  red:     "bg-red-500/15 text-red-300",
  purple:  "bg-purple-500/15 text-purple-300",
  teal:    "bg-teal-500/15 text-teal-300",
  green:   "bg-green-500/15 text-green-300",
  blue:    "bg-blue-500/15 text-blue-300",
  muted:   "bg-gray-700/60 text-gray-400",
} as const;

type ChipTone = keyof typeof CHIP_TONES;

/** The one shape every type label on this screen uses; only the colour varies. */
function Chip({ tone, children }: { tone: ChipTone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center shrink-0 rounded-md px-1.5 py-px text-[11px] font-semibold leading-4 whitespace-nowrap ${CHIP_TONES[tone]}`}>
      {children}
    </span>
  );
}

function Chevron({ className = "" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14" height="14" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden
      className={`text-gray-600 shrink-0 ${className}`}
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

const ROW_BUTTON =
  "w-full text-left flex items-center gap-3 pl-3 pr-3 py-3 min-h-[52px] transition-colors hover:bg-gray-700/30 active:bg-gray-700/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-400";

// ─── Summaries ────────────────────────────────────────────────────────────────

function renderPart(part: SummaryPart): ReactNode {
  return part.map((seg, i) => (
    <Fragment key={i}>
      {seg.fig ? <Fig>{seg.text}</Fig> : seg.text}
      {seg.arrow !== undefined && <NextArrow dir={seg.arrow} />}
    </Fragment>
  ));
}

function gymSummary(data: GymData): ReactNode {
  return joinDots(gymSummaryParts(data).map(renderPart));
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(startedAt: number, completedAt: number): string {
  if (startedAt === completedAt) return "—";
  const secs = Math.round((completedAt - startedAt) / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
}

// ─── Weeks ────────────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;

/** Local midnight of the Monday that starts the week containing `ts`. */
function weekStart(ts: number): number {
  return startOfWeek(ts).getTime();
}

function weekLabel(start: number, now: number): string {
  const thisWeek = weekStart(now);
  if (start === thisWeek) return "This week";
  // Seven days back can land an hour off across a DST change, so compare weeks, not timestamps.
  if (start === weekStart(thisWeek - DAY_MS)) return "Last week";
  const a = new Date(start);
  // Noon on Sunday, so a DST change inside the week can't pull the end back to Saturday.
  const b = new Date(start + 6 * DAY_MS + DAY_MS / 2);
  const month = (d: Date) => d.toLocaleDateString(undefined, { month: "short" });
  const range = a.getMonth() === b.getMonth()
    ? `${month(a)} ${a.getDate()}–${b.getDate()}`
    : `${month(a)} ${a.getDate()} – ${month(b)} ${b.getDate()}`;
  return b.getFullYear() === new Date(now).getFullYear() ? range : `${range}, ${b.getFullYear()}`;
}

function weekTally(items: TimelineItem[]): string {
  const workouts = items.filter((i) => i.kind === "session").length;
  const climbDays = items.filter((i) => i.kind === "climbs").length;
  const parts: string[] = [];
  if (workouts > 0) parts.push(`${workouts} workout${workouts === 1 ? "" : "s"}`);
  if (climbDays > 0) parts.push(`${climbDays} climbing day${climbDays === 1 ? "" : "s"}`);
  return parts.join(" · ");
}

/** Weekday over day number; blank for later entries on the same day, like a paper log. */
function DateColumn({ ts, show }: { ts: number; show: boolean }) {
  const d = new Date(ts);
  return (
    <div className="w-9 shrink-0 self-start flex flex-col items-center leading-none pt-0.5" aria-hidden={!show}>
      {show && (
        <>
          <span className="text-[11px] font-medium text-gray-500">
            {d.toLocaleDateString(undefined, { weekday: "short" })}
          </span>
          <span className="font-num text-xl text-white mt-1">{d.getDate()}</span>
        </>
      )}
    </div>
  );
}

// ─── Timeline types ───────────────────────────────────────────────────────────

type TimelineItem =
  | { kind: "session"; record: SessionRecord; ts: number }
  | { kind: "climbs"; date: string; ts: number; climbs: ClimbRecord[] }
  | { kind: "note"; record: NoteRecord; ts: number };

// ─── Grade range helpers ──────────────────────────────────────────────────────

function gradeRangeOf(grades: string[], scale: readonly string[]): string | null {
  if (grades.length === 0) return null;
  const indexed = grades.map((g) => scale.indexOf(g)).filter((i) => i !== -1);
  if (indexed.length === 0) return grades[0];
  const min = Math.min(...indexed);
  const max = Math.max(...indexed);
  return min === max ? scale[min] : `${scale[min]}–${scale[max]}`;
}

function climbDaySummary(climbs: ClimbRecord[]): ReactNode[] {
  const sport = climbs.filter((c) => c.type === "sport").map((c) => c.grade);
  const boulder = climbs.filter((c) => c.type === "boulder").map((c) => c.grade);
  const parts: ReactNode[] = [];
  if (sport.length > 0) {
    const range = gradeRangeOf(sport, SPORT_GRADES);
    parts.push(<><Fig>{sport.length}</Fig> route{sport.length !== 1 ? "s" : ""}</>);
    if (range) parts.push(<Fig>{range}</Fig>);
  }
  if (boulder.length > 0) {
    const range = gradeRangeOf(boulder, BOULDER_GRADES);
    parts.push(<><Fig>{boulder.length}</Fig> problem{boulder.length !== 1 ? "s" : ""}</>);
    if (range) parts.push(<Fig>{range}</Fig>);
  }
  return parts;
}

// ─── Style badge ──────────────────────────────────────────────────────────────

const STYLE_TONES: Record<string, ChipTone> = {
  onsight: "green",
  flash: "blue",
  redpoint: "red",
  attempt: "muted",
};

// ─── Rows ─────────────────────────────────────────────────────────────────────

function ClimbDayRow({ climbs, showDate, onRouteClick, defaultExpanded = false }: {
  climbs: ClimbRecord[];
  showDate: boolean;
  onRouteClick: (routeName: string) => void;
  defaultExpanded?: boolean;
}) {
  const ts = dateKeyToTime(climbs[0].date);
  const hasOutdoor = climbs.some((c) => c.setting === "outdoor");
  const locations = [...new Set(
    climbs
      .map((c) => shortLocation(c.location))
      .filter(Boolean)
  )];
  const summary = climbDaySummary(climbs);
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <>
      <button
        className={ROW_BUTTON}
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        <DateColumn ts={ts} show={showDate} />
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <Chip tone={hasOutdoor ? "teal" : "orange"}>{hasOutdoor ? "Outdoor" : "Indoor"}</Chip>
            {locations.length > 0 && (
              <span className="text-gray-300 text-sm truncate">{locations.join(" · ")}</span>
            )}
          </div>
          {summary.length > 0 && <p className="text-gray-400 text-[13px]">{joinDots(summary)}</p>}
        </div>
        <Chevron className={`transition-transform ${expanded ? "rotate-90" : ""}`} />
      </button>
      {expanded && (
        <div className="ml-12 mr-3 mb-2 border-l border-gray-700 pl-3 flex flex-col">
          {climbs.map((c) => {
            const falls = c.style === "redpoint" ? c.climbs - 1 : 0;
            const styleLabel =
              c.style === "attempt"   ? (c.climbs > 1 ? `${c.climbs} attempts` : "attempt") :
              c.style === "redpoint"  ? (falls > 0 ? `${falls} attempt${falls !== 1 ? "s" : ""} · send` : "redpoint") :
              c.style;
            return (
              <button
                key={c.id}
                className="flex flex-col gap-0.5 text-left w-full hover:bg-gray-700/40 rounded-lg px-2 -mx-2 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
                onClick={() => onRouteClick(c.route)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-gray-200 text-sm flex-1 truncate">{c.route}</span>
                  <span className="font-num text-gray-300 text-sm">{c.grade}</span>
                  <Chip tone={STYLE_TONES[c.style] ?? "muted"}>{styleLabel}</Chip>
                </div>
                {c.notes && (
                  <p className="text-gray-500 text-xs italic">"{c.notes}"</p>
                )}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

function NoteRow({ record, showDate, onEdit }: {
  record: NoteRecord;
  showDate: boolean;
  onEdit: (n: NoteRecord) => void;
}) {
  const ts = dateKeyToTime(record.date);
  return (
    <button className={ROW_BUTTON} onClick={() => onEdit(record)}>
      <DateColumn ts={ts} show={showDate} />
      <div className="flex flex-col items-start gap-1 min-w-0 flex-1">
        <Chip tone="purple">{record.category || "Note"}</Chip>
        <p className="text-gray-200 text-sm whitespace-pre-wrap break-words">
          {record.text}
        </p>
      </div>
      <Chevron />
    </button>
  );
}

function sessionTone(record: SessionRecord): ChipTone {
  if (record.gymData === undefined) return "neutral";
  return record.workoutType === "injury" ? "red" : "orange";
}

function SessionRow({ record, showDate, prCount, onEdit }: {
  record: SessionRecord;
  showDate: boolean;
  prCount: number;
  onEdit: (r: SessionRecord) => void;
}) {
  const label = workoutLabel(record);
  const duration = formatDuration(record.startedAt, record.completedAt);
  const isGym = record.gymData !== undefined;
  const nextSummary = isGym ? null : sessionNextSummary(record);

  return (
    <button className={ROW_BUTTON} onClick={() => onEdit(record)}>
      <DateColumn ts={record.startedAt} show={showDate} />
      <div className="flex flex-col gap-1 min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <Chip tone={sessionTone(record)}>{label}</Chip>
          {!isGym && <span className="font-num text-sm text-gray-100">{duration}</span>}
          {nextSummary && (nextSummary.up > 0 || nextSummary.down > 0) && (
            <span className="font-num text-sm flex items-center gap-1.5">
              {nextSummary.up > 0 && <span className="text-green-400">↑{nextSummary.up}</span>}
              {nextSummary.down > 0 && <span className="text-red-400">↓{nextSummary.down}</span>}
            </span>
          )}
          {prCount > 0 && <PRBadge count={prCount} />}
          {record.bailed && <span className="text-yellow-400 text-xs font-medium">Bailed</span>}
          {record.imported && <span className="text-gray-500 text-xs font-medium">Imported</span>}
          <span className="ml-auto pl-1 text-gray-500 text-[11px] whitespace-nowrap">
            {formatTime(record.startedAt)}
          </span>
        </div>
        {isGym && record.gymData && (
          <p className="text-gray-400 text-[13px]">{gymSummary(record.gymData)}</p>
        )}
        {record.notes && (
          <p className="text-gray-500 text-xs italic truncate">"{record.notes}"</p>
        )}
      </div>
      <Chevron />
    </button>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

const PILL_ROW = "flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

function subChipClass(selected: boolean): string {
  return `shrink-0 h-8 px-3 rounded-full text-xs font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 ${
    selected
      ? "bg-accent-500/15 text-accent-300 ring-1 ring-inset ring-accent-400/50"
      : "text-gray-400 border border-gray-700 hover:text-gray-200"
  }`;
}

export function HistoryScreen({
  view,
  onViewChange,
  onAddNote,
  onEdit,
  onEditNote,
  onShowSettings,
}: Props) {
  const { data: { sessions: storedSessions, climbs, notes }, loading } = useHistoryData();
  const liftLibrary = useWorkoutStore((s) => s.lifts);
  // Resolved once here so the rows, the search and the filters all agree on a lift's name.
  const sessions = useMemo(
    () => storedSessions.map((r) => withCurrentLiftNames(r, liftLibrary)),
    [storedSessions, liftLibrary],
  );
  const prsBySession = useMemo(() => sessionPRs(sessions), [sessions]);
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const { filter, query } = view;
  const selectedTags = useMemo(() => new Set(view.tags), [view.tags]);
  const workoutTypes = useMemo(() => new Set(view.types), [view.types]);
  const setQuery = (q: string) => onViewChange({ query: q });
  const setSelectedTags = (next: Set<string>) => onViewChange({ tags: [...next] });
  const setWorkoutTypes = (next: Set<string>) => onViewChange({ types: [...next] });
  const scrollRef = useScrollRestore<HTMLElement>("history", !loading);

  // Workout type chips: only types present in history, hangboard group first.
  const typeGroups = useMemo(() => workoutTypeGroups(sessions), [sessions]);

  const toggleIn = (current: Set<string>, apply: (next: Set<string>) => void) =>
    (t: string) => {
      const next = new Set(current);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      apply(next);
    };
  const toggleWorkoutType = toggleIn(workoutTypes, setWorkoutTypes);
  const toggleTag = toggleIn(selectedTags, setSelectedTags);

  // Distinct note categories, most-used first, for the tag sub-filter.
  const noteTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of notes) {
      const c = n.category?.trim();
      if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  }, [notes]);

  const timeline = useMemo((): TimelineItem[] => {
    // Group climbs by date string
    const climbsByDate = new Map<string, ClimbRecord[]>();
    for (const c of climbs) {
      const arr = climbsByDate.get(c.date) ?? [];
      arr.push(c);
      climbsByDate.set(c.date, arr);
    }
    const climbItems: TimelineItem[] = [...climbsByDate.entries()].map(([date, cs]) => ({
      kind: "climbs",
      date,
      ts: dateKeyToTime(date),
      climbs: cs,
    }));
    const sessionItems: TimelineItem[] = sessions.map((record) => ({
      kind: "session",
      record,
      ts: record.startedAt,
    }));
    const noteItems: TimelineItem[] = notes.map((record) => ({
      kind: "note",
      record,
      // Anchor to noon on the date; offset by createdAt within the day so multiple notes order stably
      ts: dateKeyToTime(record.date) + (record.createdAt % 86_400_000) / 1000,
    }));
    let all = [...sessionItems, ...climbItems, ...noteItems].sort((a, b) => b.ts - a.ts);

    if (filter === "workouts") {
      all = all.filter(
        (i) => i.kind === "session" &&
          (workoutTypes.size === 0 || workoutTypes.has(i.record.workoutType)),
      );
    } else if (filter === "climbs") {
      all = all.filter((i) => i.kind === "climbs");
    } else if (filter === "notes") {
      all = all.filter(
        (i) => i.kind === "note" &&
          (selectedTags.size === 0 || selectedTags.has(i.record.category?.trim() ?? "")),
      );
    }

    const q = normalizeQuery(query);
    if (q !== "") {
      all = all.flatMap((i): TimelineItem[] => {
        if (i.kind === "session") return sessionMatchesQuery(i.record, q) ? [i] : [];
        if (i.kind === "note") return noteMatchesQuery(i.record, q) ? [i] : [];
        const matching = i.climbs.filter((c) => climbMatchesQuery(c, q));
        return matching.length > 0 ? [{ ...i, climbs: matching }] : [];
      });
    }
    return all;
  }, [sessions, climbs, notes, filter, selectedTags, workoutTypes, query]);

  // The timeline is newest-first, so each week's entries are already contiguous.
  const weeks = useMemo(() => {
    const out: { start: number; label: string; items: TimelineItem[] }[] = [];
    for (const item of timeline) {
      const start = weekStart(item.ts);
      const last = out[out.length - 1];
      if (last && last.start === start) last.items.push(item);
      else out.push({ start, label: weekLabel(start, now), items: [item] });
    }
    return out;
  }, [timeline, now]);

  const searching = normalizeQuery(query) !== "";

  return (
    <div className="h-full bg-gray-900 flex flex-col">
      <header className="bg-gray-800 pl-4 pr-2 pt-4 pb-3 flex items-center gap-1">
        <h1 className="text-white font-bold text-xl">History</h1>
        <button
          onClick={onAddNote}
          className="ml-auto text-gray-400 hover:text-white transition-colors p-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
          aria-label="Add note"
          title="Add note"
        >
          <NoteIcon size={22} />
        </button>
        <button
          onClick={onShowSettings}
          aria-label="Open settings"
          data-testid="open-settings"
          className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
        >
          <GearIcon size={22} />
        </button>
      </header>

      {/* Search + filter pills */}
      {!loading && (sessions.length > 0 || climbs.length > 0 || notes.length > 0) && (
        <div className="px-4 pt-3 shrink-0 flex flex-col gap-2">
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search history"
              className="w-full h-10 bg-gray-800 border border-gray-700 rounded-lg px-3 pr-10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-500"
            />
            {query !== "" && (
              <button
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors p-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <div className={PILL_ROW}>
            {(["all", "workouts", "climbs", "notes"] as const).map((f) => (
              <button
                key={f}
                onClick={() =>
                  // One patch, not three: each call derives from the current
                  // view, so separate ones would overwrite each other.
                  onViewChange({
                    filter: f,
                    tags: f === "notes" ? view.tags : [],
                    types: f === "workouts" ? view.types : [],
                  })
                }
                aria-pressed={filter === f}
                className={`shrink-0 h-9 px-3.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 ${
                  filter === f
                    ? "bg-accent-500 text-gray-950 font-semibold"
                    : "bg-gray-800 text-gray-400 border border-gray-700 hover:text-gray-200"
                }`}
              >
                {f === "all" ? "All" : f === "workouts" ? "Workouts" : f === "climbs" ? "Climbs" : "Notes"}
              </button>
            ))}
          </div>
          {/* Workout type sub-filter */}
          {filter === "workouts" && (typeGroups.hangboard.length > 0 || typeGroups.gym.length > 0) && (
            <div className={PILL_ROW}>
              {typeGroups.hangboard.map((t) => (
                <button
                  key={t}
                  onClick={() => toggleWorkoutType(t)}
                  aria-pressed={workoutTypes.has(t)}
                  className={subChipClass(workoutTypes.has(t))}
                >
                  {workoutTypeLabel(t)}
                </button>
              ))}
              {typeGroups.hangboard.length > 0 && typeGroups.gym.length > 0 && (
                <div className="shrink-0 w-px h-5 bg-gray-700 mx-0.5" />
              )}
              {typeGroups.gym.map((t) => (
                <button
                  key={t}
                  onClick={() => toggleWorkoutType(t)}
                  aria-pressed={workoutTypes.has(t)}
                  className={subChipClass(workoutTypes.has(t))}
                >
                  {workoutTypeLabel(t)}
                </button>
              ))}
              {workoutTypes.size > 0 && (
                <button
                  onClick={() => setWorkoutTypes(new Set())}
                  className="shrink-0 h-8 text-gray-500 hover:text-gray-300 text-xs font-medium transition-colors whitespace-nowrap px-2"
                >
                  clear
                </button>
              )}
            </div>
          )}
          {/* Note tag sub-filter */}
          {filter === "notes" && noteTags.length > 0 && (
            <div className={PILL_ROW}>
              {noteTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  aria-pressed={selectedTags.has(tag)}
                  className={subChipClass(selectedTags.has(tag))}
                >
                  {tag}
                </button>
              ))}
              {selectedTags.size > 0 && (
                <button
                  onClick={() => setSelectedTags(new Set())}
                  className="shrink-0 h-8 text-gray-500 hover:text-gray-300 text-xs font-medium transition-colors whitespace-nowrap px-2"
                >
                  clear
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <main
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 pt-4 pb-6 flex flex-col gap-5"
      >
        {loading && <p className="text-gray-500 text-center py-12">Loading…</p>}
        {!loading && timeline.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            {searching ? (
              <p className="text-gray-400 text-base font-medium">
                No results for "{query.trim()}"
              </p>
            ) : (
              <>
                <p className="text-gray-400 text-base font-medium">
                  {filter === "all" ? "No workouts yet" : `No ${filter} yet`}
                </p>
                <p className="text-gray-600 text-sm">
                  {filter === "all"
                    ? "Complete a session to see your history here."
                    : filter === "notes"
                      ? "Tap the note icon above to add one."
                      : `Log a ${filter.slice(0, -1)} to see it here.`}
                </p>
              </>
            )}
          </div>
        )}
        {weeks.map((week) => {
          const tally = weekTally(week.items);
          return (
            <section key={week.start} className="shrink-0 flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3 px-1">
                <h2 className="text-sm font-semibold text-gray-300">{week.label}</h2>
                {tally && <span className="text-xs text-gray-500">{tally}</span>}
              </div>
              <ul className="bg-gray-800 rounded-2xl overflow-hidden">
                {week.items.map((item, i) => {
                  const prev = week.items[i - 1];
                  const newDay = !prev || toLocalDateString(prev.ts) !== toLocalDateString(item.ts);
                  return (
                    <li
                      key={item.kind === "climbs" ? `${item.date}-${searching}` : item.record.id}
                      className={i === 0 ? "" : newDay
                        ? "border-t border-gray-700/60"
                        // Same-day rows share the date column, so their divider starts after it.
                        : "relative before:absolute before:top-0 before:left-12 before:right-0 before:h-px before:bg-gray-700/40"}
                    >
                      {item.kind === "session" ? (
                        <SessionRow record={item.record} showDate={newDay} prCount={prsBySession.get(item.record.id)?.length ?? 0} onEdit={onEdit} />
                      ) : item.kind === "climbs" ? (
                        <ClimbDayRow
                          climbs={item.climbs}
                          showDate={newDay}
                          onRouteClick={setSelectedRoute}
                          defaultExpanded={searching}
                        />
                      ) : (
                        <NoteRow record={item.record} showDate={newDay} onEdit={onEditNote} />
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </main>

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
