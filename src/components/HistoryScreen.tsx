import { useEffect, useMemo, useRef, useState } from "react";
import { getSessions, addSession } from "../lib/history";
import type { SessionRecord, GymData } from "../lib/history";
import { getClimbs } from "../lib/climbs";
import type { ClimbRecord } from "../lib/climbs";
import { getNotes } from "../lib/notes";
import type { NoteRecord } from "../lib/notes";
import { SPORT_GRADES, BOULDER_GRADES } from "../constants/climbGrades";
import { shortLocation } from "../lib/format";
import { RouteHistoryModal } from "./RouteHistoryModal";
import { BackChevronIcon, ClockIcon } from "./icons";

type Props = {
  onBack: () => void;
  onImport: () => void;
  onImportGym: () => void;
  onAddNote: () => void;
  onEdit: (record: SessionRecord) => void;
  onEditNote: (note: NoteRecord) => void;
};

type TimelineFilter = "all" | "workouts" | "climbs" | "notes";

const GYM_LABELS: Record<string, string> = {
  "arc":              "ARC",
  "cir":              "CIR",
  "pe-route":         "PE Route Intervals",
  "lbc":              "LBC",
  "performance":      "Performance",
  "wbl":              "WBL",
  "hard-bouldering":  "Hard Bouldering",
  "limit-bouldering": "Limit Bouldering",
  "injury":           "Injury",
};

function workoutLabel(record: SessionRecord): string {
  if (record.workoutType === "max-hang") return "Max Hang";
  if (record.workoutType === "beginner") return "Beginner";
  if (record.workoutType === "repeaters") return "Repeaters";
  return GYM_LABELS[record.workoutType] ?? record.workoutType;
}

function gymSummary(data: GymData): string {
  switch (data.type) {
    case "arc": {
      const parts: string[] = [`${data.climbMin} min`];
      if (data.routes) parts.push(`${data.routes} routes`);
      if (data.downclimb === "Yes") parts.push("downclimb");
      if (data.maxGrade) parts.push(`Max ${data.maxGrade}`);
      return parts.join(" · ");
    }
    case "cir": {
      const parts: string[] = [`${data.repeats} repeats`];
      if (data.climbRating) parts.push(data.climbRating);
      parts.push(`~${data.avgRestSec}s rest`);
      return parts.join(" · ");
    }
    case "pe-route":
      return `${data.climbSec}s on · ${data.dutyCycle} rest · ${data.reps} reps`;
    case "lbc":
      return `${data.sets} sets · ${data.climbSec}s on · ${data.dutyCycle} rest`;
    case "performance":
      return `${data.grade} · ${data.tries} tries · ${data.success === "Yes" ? "sent" : "no send"}`;
    case "wbl":
      return `Top ${data.topV} · ${data.durationMin} min`;
    case "hard-bouldering":
    case "limit-bouldering":
      return `${data.level} · ${data.durationMin} min`;
    case "injury": {
      const parts: string[] = [];
      if (data.bodyPart) parts.push(data.bodyPart);
      if (data.severity) parts.push(data.severity);
      return parts.join(" · ") || "—";
    }
  }
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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

function climbDaySummary(climbs: ClimbRecord[]): string {
  const sport = climbs.filter((c) => c.type === "sport").map((c) => c.grade);
  const boulder = climbs.filter((c) => c.type === "boulder").map((c) => c.grade);
  const parts: string[] = [];
  if (sport.length > 0) {
    const range = gradeRangeOf(sport, SPORT_GRADES);
    parts.push(`${sport.length} route${sport.length !== 1 ? "s" : ""}${range ? ` · ${range}` : ""}`);
  }
  if (boulder.length > 0) {
    const range = gradeRangeOf(boulder, BOULDER_GRADES);
    parts.push(`${boulder.length} problem${boulder.length !== 1 ? "s" : ""}${range ? ` · ${range}` : ""}`);
  }
  return parts.join(" · ");
}

// ─── Style badge ──────────────────────────────────────────────────────────────

const STYLE_COLORS: Record<string, string> = {
  onsight: "bg-green-500/20 text-green-400",
  flash:   "bg-blue-500/20 text-blue-400",
  redpoint:"bg-red-500/20 text-red-400",
  attempt: "bg-gray-700 text-gray-500",
};

// ─── ClimbDayCard ─────────────────────────────────────────────────────────────

function ClimbDayCard({ climbs, onRouteClick }: { climbs: ClimbRecord[]; onRouteClick: (routeName: string) => void }) {
  const ts = new Date(`${climbs[0].date}T12:00:00`).getTime();
  const hasOutdoor = climbs.some((c) => c.setting === "outdoor");
  const locations = [...new Set(
    climbs
      .map((c) => shortLocation(c.location))
      .filter(Boolean)
  )];
  const summary = climbDaySummary(climbs);
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-gray-800 rounded-xl overflow-hidden shrink-0">
      <button
        className="w-full text-left px-4 py-3 flex items-center justify-between gap-3"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-semibold text-sm">{formatDate(ts)}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              hasOutdoor ? "bg-teal-500/20 text-teal-400" : "bg-orange-500/20 text-orange-400"
            }`}>
              {hasOutdoor ? "Outdoor" : "Indoor"}
            </span>
            {locations.length > 0 && (
              <span className="text-gray-400 text-xs truncate max-w-[180px]">
                {locations.join(" · ")}
              </span>
            )}
          </div>
          {summary && <p className="text-gray-400 text-xs mt-0.5">{summary}</p>}
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16" height="16" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round"
          className={`text-gray-600 flex-shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
      {expanded && (
        <div className="border-t border-gray-700 px-4 py-2 flex flex-col gap-2">
          {climbs.map((c) => {
            const falls = c.style === "redpoint" ? c.climbs - 1 : 0;
            const styleLabel =
              c.style === "attempt"   ? (c.climbs > 1 ? `${c.climbs} attempts` : "attempt") :
              c.style === "redpoint"  ? (falls > 0 ? `${falls} attempt${falls !== 1 ? "s" : ""} · send` : "redpoint") :
              c.style;
            return (
              <button
                key={c.id}
                className="flex flex-col gap-0.5 text-left w-full hover:bg-gray-700/50 rounded px-1 -mx-1 py-0.5 transition-colors"
                onClick={() => onRouteClick(c.route)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-gray-300 text-xs flex-1 truncate">{c.route}</span>
                  <span className="text-gray-500 text-xs font-mono">{c.grade}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${STYLE_COLORS[c.style] ?? STYLE_COLORS.attempt}`}>
                    {styleLabel}
                  </span>
                </div>
                {c.notes && (
                  <p className="text-gray-500 text-xs italic pl-0.5">"{c.notes}"</p>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NoteCard({ record, onEdit }: { record: NoteRecord; onEdit: (n: NoteRecord) => void }) {
  const ts = new Date(`${record.date}T12:00:00`).getTime();
  return (
    <div className="bg-gray-800 rounded-xl overflow-hidden shrink-0">
      <button
        className="w-full text-left px-4 py-3 flex items-start justify-between gap-3"
        onClick={() => onEdit(record)}
      >
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-semibold text-sm">{formatDate(ts)}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-purple-500/20 text-purple-300">
              {record.category || "Note"}
            </span>
          </div>
          <p className="text-gray-300 text-sm mt-1 whitespace-pre-wrap break-words">
            {record.text}
          </p>
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16" height="16" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round"
          className="text-gray-600 flex-shrink-0 mt-1"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </div>
  );
}

function SessionCard({ record, onEdit }: { record: SessionRecord; onEdit: (r: SessionRecord) => void }) {
  const label = workoutLabel(record);
  const duration = formatDuration(record.startedAt, record.completedAt);
  const isGym = record.gymData !== undefined;

  return (
    <div className="bg-gray-800 rounded-xl overflow-hidden shrink-0">
      <button
        className="w-full text-left px-4 py-3 flex items-center justify-between gap-3"
        onClick={() => onEdit(record)}
      >
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-semibold text-sm">{formatDate(record.startedAt)}</span>
            <span className="text-gray-400 text-xs">{formatTime(record.startedAt)}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              isGym ? "bg-orange-500/20 text-orange-400" : "bg-gray-700 text-gray-300"
            }`}>
              {label}
            </span>
            {!isGym && <span className="text-gray-400 text-xs">{duration}</span>}
            {record.bailed && <span className="text-yellow-400 text-xs font-medium">Bailed</span>}
            {record.imported && <span className="text-indigo-400 text-xs font-medium">Imported</span>}
            {record.notes && (
              <span className="text-gray-500 text-xs italic truncate max-w-[160px]">"{record.notes}"</span>
            )}
          </div>
          {isGym && record.gymData && (
            <p className="text-gray-400 text-xs mt-0.5">{gymSummary(record.gymData)}</p>
          )}
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-gray-600 flex-shrink-0"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </div>
  );
}

const ALL_VALID_TYPES = new Set([
  "repeaters", "max-hang", "beginner",
  "arc", "cir", "pe-route", "lbc", "wbl",
  "performance", "hard-bouldering", "limit-bouldering", "injury",
]);

export function HistoryScreen({ onBack, onImport, onImportGym, onAddNote, onEdit, onEditNote }: Props) {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [climbs, setClimbs] = useState<ClimbRecord[]>([]);
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [filter, setFilter] = useState<TimelineFilter>("all");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([getSessions(), getClimbs(), getNotes()])
      .then(([s, c, n]) => { setSessions(s); setClimbs(c); setNotes(n); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

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
      ts: new Date(`${date}T12:00:00`).getTime(),
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
      ts: new Date(`${record.date}T12:00:00`).getTime() + (record.createdAt % 86_400_000) / 1000,
    }));
    const all = [...sessionItems, ...climbItems, ...noteItems].sort((a, b) => b.ts - a.ts);
    if (filter === "all") return all;
    if (filter === "workouts") return all.filter((i) => i.kind === "session");
    if (filter === "climbs") return all.filter((i) => i.kind === "climbs");
    return all.filter((i) => i.kind === "note");
  }, [sessions, climbs, notes, filter]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImportStatus("Importing…");
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data)) throw new Error("Expected a JSON array");
      let count = 0;
      for (const item of data) {
        if (
          typeof item !== "object" || item === null ||
          typeof item.id !== "string" ||
          !ALL_VALID_TYPES.has(item.workoutType) ||
          typeof item.startedAt !== "number" ||
          !Array.isArray(item.holds)
        ) {
          throw new Error(`Invalid record: ${JSON.stringify(item).slice(0, 60)}`);
        }
        await addSession({ ...item, imported: true } as SessionRecord);
        count++;
      }
      const refreshed = await getSessions();
      setSessions(refreshed);
      setImportStatus(`Imported ${count} session${count !== 1 ? "s" : ""}`);
    } catch (err) {
      setImportStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
    setTimeout(() => setImportStatus(null), 4000);
  };

  return (
    <div className="h-dvh bg-gray-900 flex flex-col">
      <header className="bg-gray-800 px-4 pt-4 pb-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-white transition-colors p-1 -ml-1"
          aria-label="Back"
        >
          <BackChevronIcon />
        </button>
        <ClockIcon className="text-white" aria-label="Workout History" />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="ml-auto text-gray-400 hover:text-white transition-colors p-1"
          aria-label="Import JSON"
          title="Import JSON file"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="12" y1="18" x2="12" y2="12"/>
            <polyline points="9 15 12 12 15 15"/>
          </svg>
        </button>
        <input
          type="file"
          accept=".json"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />
        {/* + button with inline menu */}
        <div className="relative">
          <button
            onClick={() => setAddMenuOpen((v) => !v)}
            className="text-gray-400 hover:text-white transition-colors p-1"
            aria-label="Log workout"
            title="Log workout"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14" /><path d="M5 12h14" />
            </svg>
          </button>
          {addMenuOpen && (
            <div className="absolute right-0 top-full mt-1 bg-gray-700 rounded-xl shadow-lg z-10 overflow-hidden min-w-[160px]">
              <button
                onClick={() => { setAddMenuOpen(false); onImport(); }}
                className="w-full text-left px-4 py-3 text-sm text-gray-200 hover:bg-gray-600 transition-colors"
              >
                Hangboard
              </button>
              <button
                onClick={() => { setAddMenuOpen(false); onImportGym(); }}
                className="w-full text-left px-4 py-3 text-sm text-orange-400 hover:bg-gray-600 transition-colors border-t border-gray-600"
              >
                Gym Session
              </button>
              <button
                onClick={() => { setAddMenuOpen(false); onAddNote(); }}
                className="w-full text-left px-4 py-3 text-sm text-purple-300 hover:bg-gray-600 transition-colors border-t border-gray-600"
              >
                Note
              </button>
            </div>
          )}
        </div>
      </header>
      {importStatus && (
        <div className="bg-gray-800 border-t border-gray-700 px-4 py-2 text-sm text-gray-300">
          {importStatus}
        </div>
      )}

      {/* Filter pills */}
      {!loading && (sessions.length > 0 || climbs.length > 0 || notes.length > 0) && (
        <div className="px-4 pt-3 shrink-0">
          <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {(["all", "workouts", "climbs", "notes"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                  filter === f
                    ? f === "notes" ? "bg-purple-600 text-white" : "bg-indigo-600 text-white"
                    : "bg-gray-800 text-gray-400 border border-gray-700"
                }`}
              >
                {f === "all" ? "All" : f === "workouts" ? "Workouts" : f === "climbs" ? "Climbs" : "Notes"}
              </button>
            ))}
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {loading && <p className="text-gray-500 text-center py-12">Loading…</p>}
        {!loading && timeline.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <p className="text-gray-400 text-base font-medium">
              {filter === "all" ? "No workouts yet" : `No ${filter} yet`}
            </p>
            <p className="text-gray-600 text-sm">
              {filter === "all"
                ? "Complete a session to see your history here."
                : `Add a ${filter === "notes" ? "note" : filter.slice(0, -1)} from the + menu.`}
            </p>
          </div>
        )}
        {timeline.map((item) =>
          item.kind === "session" ? (
            <SessionCard key={item.record.id} record={item.record} onEdit={onEdit} />
          ) : item.kind === "climbs" ? (
            <ClimbDayCard key={item.date} climbs={item.climbs} onRouteClick={setSelectedRoute} />
          ) : (
            <NoteCard key={item.record.id} record={item.record} onEdit={onEditNote} />
          )
        )}
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
