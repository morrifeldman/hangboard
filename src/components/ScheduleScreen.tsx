import { useEffect, useState, useMemo } from "react";
import { CalendarIcon, GearIcon, NoteIcon } from "./icons";
import {
  addDays,
  buildScheduleWeeks,
  deleteScheduleByDate,
  getSchedules,
  SCHEDULE_TYPE_META,
  SCHEDULE_TYPE_ORDER,
  startOfWeek,
  upsertSchedule,
} from "../lib/schedules";
import type {
  ScheduleDay,
  ScheduleDayType,
  ScheduleRecord,
  TypeStatus,
} from "../lib/schedules";
import { getSessions } from "../lib/history";
import type { SessionRecord } from "../lib/history";
import { getClimbs } from "../lib/climbs";
import type { ClimbRecord } from "../lib/climbs";

const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Offset is in weeks relative to the current (today's) week. */
function weekTitle(offset: number, weekStart: Date): string {
  if (offset === 0) return "This week";
  if (offset === 1) return "Next week";
  if (offset === -1) return "Last week";
  return `Week of ${MONTHS[weekStart.getMonth()]} ${weekStart.getDate()}`;
}

type Props = { onShowSettings: () => void };

export function ScheduleScreen({ onShowSettings }: Props) {
  const [schedules, setSchedules] = useState<ScheduleRecord[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [climbs, setClimbs] = useState<ClimbRecord[]>([]);
  const [weekCount, setWeekCount] = useState(3);
  const [editingDate, setEditingDate] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getSchedules(), getSessions(), getClimbs()])
      .then(([s, sess, c]) => {
        setSchedules(s);
        setSessions(sess);
        setClimbs(c);
      })
      .catch(() => {});
  }, []);

  // Anchor the current week, then start the view one week earlier so recent
  // workouts stay visible (e.g. last week's sessions when it's Monday).
  const thisWeekStart = useMemo(() => startOfWeek(new Date()), []);
  const weekStart = useMemo(() => addDays(thisWeekStart, -7), [thisWeekStart]);
  const weeks = useMemo(
    () => buildScheduleWeeks(weekStart, weekCount, schedules, sessions, climbs),
    [weekStart, weekCount, schedules, sessions, climbs],
  );

  const refreshSchedules = async () => {
    const next = await getSchedules();
    setSchedules(next);
  };

  const handleSave = async (
    date: string,
    dayTypes: ScheduleDayType[],
    note: string,
  ) => {
    await upsertSchedule({ date, dayTypes, note });
    await refreshSchedules();
    setEditingDate(null);
  };

  const handleClear = async (date: string) => {
    await deleteScheduleByDate(date);
    await refreshSchedules();
    setEditingDate(null);
  };

  const editingDay = editingDate
    ? weeks.flat().find((d) => d.date === editingDate)
    : null;

  return (
    <div className="h-full bg-gray-900 flex flex-col" data-testid="schedule-screen">
      <header className="bg-gray-800 px-4 pt-4 pb-3 flex items-center gap-3">
        <CalendarIcon className="text-white" aria-label="Schedule" />
        <h1 className="text-white font-bold text-lg">Schedule</h1>
        <button
          onClick={onShowSettings}
          aria-label="Open settings"
          data-testid="open-settings"
          className="ml-auto text-gray-400 hover:text-white transition-colors p-1"
        >
          <GearIcon size={22} />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-6">
        {weeks.map((week, wIdx) => {
          const ws = new Date(week[0].jsDate);
          const offset = Math.round(
            (ws.getTime() - thisWeekStart.getTime()) / (7 * 24 * 60 * 60 * 1000),
          );
          return (
            <section
              key={week[0].date}
              className="flex flex-col gap-2"
              data-testid={`schedule-week-${wIdx}`}
            >
              <h2 className="text-gray-300 font-semibold text-sm uppercase tracking-wide">
                {weekTitle(offset, ws)}
              </h2>
              <div className="grid grid-cols-7 gap-1">
                {week.map((day, i) => (
                  <DayChip
                    key={day.date}
                    day={day}
                    letter={DAY_LETTERS[i]}
                    onClick={() => setEditingDate(day.date)}
                  />
                ))}
              </div>
            </section>
          );
        })}

        <button
          onClick={() => setWeekCount((n) => n + 2)}
          className="w-full py-2.5 rounded-xl bg-gray-800 active:bg-gray-700 text-gray-300 font-medium text-sm"
          data-testid="schedule-load-more"
        >
          Load 2 more weeks
        </button>

        <p className="text-gray-600 text-xs leading-relaxed">
          Tap a day to plan one or more of Power, Endurance, Hangboard, Outdoor,
          Stretching, Cardio, or Rest. Each plan shows a colored dot — it
          turns into a checkmark once you log something that fits, or a struck
          dot if a past day went unlogged.
        </p>
      </main>

      {editingDay && (
        <EditSheet
          day={editingDay}
          onSave={(types, n) => handleSave(editingDay.date, types, n)}
          onClear={() => handleClear(editingDay.date)}
          onCancel={() => setEditingDate(null)}
        />
      )}
    </div>
  );
}

// ─── DayChip ─────────────────────────────────────────────────────────────────

function DayChip({
  day,
  letter,
  onClick,
}: {
  day: ScheduleDay;
  letter: string;
  onClick: () => void;
}) {
  const ring = day.isToday ? "ring-2 ring-white/70" : "";
  const statusAttr = day.typeStatus.map((s) => `${s.type}:${s.state}`).join(",");
  return (
    <button
      onClick={onClick}
      data-testid={`schedule-day-${day.date}`}
      data-day-types={day.dayTypes.join(",")}
      data-type-status={statusAttr}
      data-adherence={day.adherence}
      className={`relative aspect-square rounded-lg bg-gray-800 ${ring} flex flex-col items-center justify-center text-white active:scale-95 transition-transform`}
    >
      <span className="text-[10px] leading-none text-white/70">{letter}</span>
      <span className="text-base font-bold leading-tight">
        {day.jsDate.getDate()}
      </span>
      <TypeRow statuses={day.typeStatus} />
      {day.note && (
        <NoteIcon
          size={14}
          className="absolute top-1 right-1 text-white/90"
          aria-label="Has note"
        />
      )}
    </button>
  );
}

/** Row of per-type markers along the bottom of a day square. */
function TypeRow({ statuses }: { statuses: TypeStatus[] }) {
  if (statuses.length === 0) return null;
  return (
    <span className="absolute bottom-1 left-0 right-0 flex items-center justify-center gap-0.5">
      {statuses.map((s) => (
        <TypeMarker key={s.type} status={s} />
      ))}
    </span>
  );
}

function TypeMarker({ status }: { status: TypeStatus }) {
  const { type, state } = status;
  const meta = SCHEDULE_TYPE_META[type];
  const color = meta.dot.replace("bg-", "text-");
  if (state === "done") {
    return (
      <svg
        viewBox="0 0 24 24"
        className={`w-3 h-3 ${color}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-label={`${meta.label} done`}
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }
  if (state === "missed") {
    return (
      <span className="relative inline-flex w-2 h-2" aria-label={`${meta.label} missed`}>
        <span className={`absolute inset-0 rounded-full ${meta.dot} opacity-40`} />
        <span className="absolute left-1/2 top-1/2 w-[3px] h-0.5 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-white/80" />
      </span>
    );
  }
  return (
    <span
      className={`w-2 h-2 rounded-full ${meta.dot}`}
      aria-label={`${meta.label} planned`}
    />
  );
}

// ─── EditSheet ───────────────────────────────────────────────────────────────

function loggedSummary(day: ScheduleDay): string | null {
  const s = day.logged.sessions.length;
  const c = day.logged.climbs.length;
  if (s + c === 0) return null;
  const parts: string[] = [];
  if (s > 0) parts.push(`${s} session${s === 1 ? "" : "s"}`);
  if (c > 0) parts.push(`${c} climb${c === 1 ? "" : "s"}`);
  return parts.join(" · ");
}

const STATE_LABEL: Record<TypeStatus["state"], string> = {
  done: "done",
  missed: "missed",
  upcoming: "planned",
};

function EditSheet({
  day,
  onSave,
  onClear,
  onCancel,
}: {
  day: ScheduleDay;
  onSave: (dayTypes: ScheduleDayType[], note: string) => void;
  onClear: () => void;
  onCancel: () => void;
}) {
  const dateLabel = day.jsDate.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const [note, setNote] = useState(day.note ?? "");
  const [selected, setSelected] = useState<Set<ScheduleDayType>>(
    () => new Set(day.dayTypes),
  );

  const toggle = (t: ScheduleDayType) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });

  const orderedSelected = SCHEDULE_TYPE_ORDER.filter((t) => selected.has(t));
  const noteChanged = note.trim() !== (day.note ?? "").trim();
  const typesChanged =
    orderedSelected.length !== day.dayTypes.length ||
    orderedSelected.some((t, i) => t !== day.dayTypes[i]);
  const dirty = noteChanged || typesChanged;

  const loggedLine = loggedSummary(day);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60"
      onClick={onCancel}
      data-testid="schedule-edit-sheet"
    >
      <div
        className="w-full sm:max-w-sm bg-gray-800 rounded-t-2xl sm:rounded-2xl p-5 flex flex-col gap-4 max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-0.5">
          <h2 className="text-white font-semibold text-base">{dateLabel}</h2>
          <p className="text-gray-400 text-xs">
            Plan this day — tap to add or remove
          </p>
        </div>

        {(day.typeStatus.length > 0 || loggedLine) && (
          <div
            className="flex flex-col gap-1.5 rounded-lg bg-gray-900/60 p-3 text-xs leading-snug"
            data-testid="schedule-adherence-summary"
          >
            {day.typeStatus.map((s) => (
              <div key={s.type} className="flex items-center gap-2">
                <span className="shrink-0">
                  <TypeMarker status={s} />
                </span>
                <span
                  className={
                    s.state === "missed"
                      ? "text-gray-500 line-through"
                      : "text-white"
                  }
                >
                  {SCHEDULE_TYPE_META[s.type].label}
                </span>
                <span className="text-gray-500">· {STATE_LABEL[s.state]}</span>
              </div>
            ))}
            {loggedLine ? (
              <span className="text-gray-400">Logged: {loggedLine}</span>
            ) : (
              !day.isPast &&
              day.dayTypes.length > 0 && (
                <span className="text-gray-500">Nothing logged yet</span>
              )
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {SCHEDULE_TYPE_ORDER.map((t) => (
            <button
              key={t}
              onClick={() => toggle(t)}
              data-testid={`schedule-pick-${t}`}
              aria-pressed={selected.has(t)}
              className={`py-3 rounded-xl text-white font-semibold text-sm ${SCHEDULE_TYPE_META[t].bg} ${
                selected.has(t) ? "ring-2 ring-white/70" : "opacity-60"
              } active:scale-95 transition-transform`}
            >
              {SCHEDULE_TYPE_META[t].label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="schedule-note"
            className="text-gray-300 text-xs font-medium"
          >
            Note
          </label>
          <textarea
            id="schedule-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="How did it go? (optional)"
            rows={3}
            className="w-full rounded-lg bg-gray-900 text-white text-sm px-3 py-2 placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-white/30 resize-none"
            data-testid="schedule-note-input"
          />
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <button
            onClick={() => onSave(orderedSelected, note)}
            disabled={!dirty}
            className="w-full py-2.5 rounded-xl bg-green-600 active:bg-green-700 disabled:opacity-40 text-white font-semibold text-sm"
            data-testid="schedule-save"
          >
            Save
          </button>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl bg-gray-700 active:bg-gray-600 text-white font-semibold text-sm"
              data-testid="schedule-cancel"
            >
              Cancel
            </button>
            <button
              onClick={onClear}
              disabled={day.dayTypes.length === 0 && !day.note}
              className="flex-1 py-2.5 rounded-xl bg-gray-700 active:bg-gray-600 disabled:opacity-40 text-white font-semibold text-sm"
              data-testid="schedule-clear"
            >
              Clear
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

