import { useEffect, useState, useMemo } from "react";
import { BackChevronIcon, CalendarIcon, NoteIcon } from "./icons";
import {
  buildScheduleWeeks,
  deleteScheduleByDate,
  getSchedules,
  SCHEDULE_TYPE_META,
  SCHEDULE_TYPE_ORDER,
  startOfWeek,
  upsertSchedule,
} from "../lib/schedules";
import type { Adherence, ScheduleDay, ScheduleDayType, ScheduleRecord } from "../lib/schedules";
import { getSessions } from "../lib/history";
import type { SessionRecord } from "../lib/history";
import { getClimbs } from "../lib/climbs";
import type { ClimbRecord } from "../lib/climbs";

const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function weekTitle(weekIndex: number, weekStart: Date): string {
  if (weekIndex === 0) return "This week";
  if (weekIndex === 1) return "Next week";
  return `Week of ${MONTHS[weekStart.getMonth()]} ${weekStart.getDate()}`;
}

type Props = { onBack: () => void };

export function ScheduleScreen({ onBack }: Props) {
  const [schedules, setSchedules] = useState<ScheduleRecord[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [climbs, setClimbs] = useState<ClimbRecord[]>([]);
  const [weekCount, setWeekCount] = useState(2);
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

  const weekStart = useMemo(() => startOfWeek(new Date()), []);
  const weeks = useMemo(
    () => buildScheduleWeeks(weekStart, weekCount, schedules, sessions, climbs),
    [weekStart, weekCount, schedules, sessions, climbs],
  );

  const refreshSchedules = async () => {
    const next = await getSchedules();
    setSchedules(next);
  };

  const handlePick = async (date: string, dayType: ScheduleDayType, note: string) => {
    await upsertSchedule({ date, dayType, note });
    await refreshSchedules();
    setEditingDate(null);
  };

  const handleSaveNote = async (date: string, note: string) => {
    await upsertSchedule({ date, note });
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
    <div className="h-dvh bg-gray-900 flex flex-col" data-testid="schedule-screen">
      <header className="bg-gray-800 px-4 pt-4 pb-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-white transition-colors p-1 -ml-1"
          aria-label="Back"
          data-testid="schedule-back"
        >
          <BackChevronIcon />
        </button>
        <CalendarIcon className="text-white" aria-label="Schedule" />
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-6">
        {weeks.map((week, wIdx) => {
          const ws = new Date(week[0].jsDate);
          return (
            <section
              key={week[0].date}
              className="flex flex-col gap-2"
              data-testid={`schedule-week-${wIdx}`}
            >
              <h2 className="text-gray-300 font-semibold text-sm uppercase tracking-wide">
                {weekTitle(wIdx, ws)}
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
          Tap a day to set Power, Endurance, Hangboard, Outdoor, Bouldering, or
          Rest. Past planned days show a green dot when something was logged.
        </p>
      </main>

      {editingDay && (
        <EditSheet
          day={editingDay}
          onPick={(t, n) => handlePick(editingDay.date, t, n)}
          onSaveNote={(n) => handleSaveNote(editingDay.date, n)}
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
  const bg = day.dayType ? SCHEDULE_TYPE_META[day.dayType].bg : "bg-gray-800";
  const ring = day.isToday ? "ring-2 ring-white/70" : "";
  return (
    <button
      onClick={onClick}
      data-testid={`schedule-day-${day.date}`}
      data-day-type={day.dayType ?? ""}
      data-adherence={day.adherence}
      className={`relative aspect-square rounded-lg ${bg} ${ring} flex flex-col items-center justify-center text-white active:scale-95 transition-transform`}
    >
      <span className="text-[10px] leading-none text-white/70">{letter}</span>
      <span className="text-base font-bold leading-tight">
        {day.jsDate.getDate()}
      </span>
      <AdherenceDot adherence={day.adherence} />
      {day.note && (
        <NoteIcon
          size={14}
          className="absolute bottom-1 right-1 text-white/90"
          aria-label="Has note"
        />
      )}
    </button>
  );
}

function AdherenceDot({ adherence }: { adherence: ScheduleDay["adherence"] }) {
  if (adherence === "none" || adherence === "planned-future") return null;
  const cls =
    adherence === "planned-and-logged"
      ? "bg-green-400"
      : adherence === "planned-not-logged"
        ? "bg-amber-400"
        : "bg-gray-400"; // unplanned-logged
  return (
    <span
      className={`absolute top-1 right-1 w-2.5 h-2.5 rounded-full ${cls}`}
      aria-hidden="true"
    />
  );
}

// ─── EditSheet ───────────────────────────────────────────────────────────────

const ADHERENCE_META: Record<
  Adherence,
  { dot: string | null; dotClass: string; label: string }
> = {
  "planned-and-logged": {
    dot: "Green",
    dotClass: "bg-green-400",
    label: "Planned and logged",
  },
  "planned-not-logged": {
    dot: "Amber",
    dotClass: "bg-amber-400",
    label: "Planned but nothing logged",
  },
  "unplanned-logged": {
    dot: "Gray",
    dotClass: "bg-gray-400",
    label: "Logged without a plan",
  },
  "planned-future": {
    dot: null,
    dotClass: "",
    label: "Planned, upcoming",
  },
  none: {
    dot: null,
    dotClass: "",
    label: "No plan, nothing logged",
  },
};

function loggedSummary(day: ScheduleDay): string | null {
  const s = day.logged.sessions.length;
  const c = day.logged.climbs.length;
  if (s + c === 0) return null;
  const parts: string[] = [];
  if (s > 0) parts.push(`${s} session${s === 1 ? "" : "s"}`);
  if (c > 0) parts.push(`${c} climb${c === 1 ? "" : "s"}`);
  return parts.join(" · ");
}

function EditSheet({
  day,
  onPick,
  onSaveNote,
  onClear,
  onCancel,
}: {
  day: ScheduleDay;
  onPick: (t: ScheduleDayType, note: string) => void;
  onSaveNote: (note: string) => void;
  onClear: () => void;
  onCancel: () => void;
}) {
  const dateLabel = day.jsDate.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const [note, setNote] = useState(day.note ?? "");
  const noteChanged = note.trim() !== (day.note ?? "").trim();

  const adh = ADHERENCE_META[day.adherence];
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
          <p className="text-gray-400 text-xs">Plan this day</p>
        </div>

        <div
          className="flex items-start gap-2.5 rounded-lg bg-gray-900/60 p-3"
          data-testid="schedule-adherence-summary"
        >
          {adh.dot ? (
            <span
              className={`mt-0.5 w-3 h-3 rounded-full shrink-0 ${adh.dotClass}`}
              aria-hidden="true"
            />
          ) : (
            <span
              className="mt-0.5 w-3 h-3 rounded-full shrink-0 border border-gray-600"
              aria-hidden="true"
            />
          )}
          <div className="flex flex-col gap-0.5 text-xs leading-snug">
            <span className="text-white font-medium">{adh.label}</span>
            {day.dayType && (
              <span className="text-gray-400">
                Planned: {SCHEDULE_TYPE_META[day.dayType].label}
              </span>
            )}
            {loggedLine ? (
              <span className="text-gray-400">Logged: {loggedLine}</span>
            ) : (
              !day.isPast && day.dayType && (
                <span className="text-gray-500">Nothing logged yet</span>
              )
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {SCHEDULE_TYPE_ORDER.map((t) => (
            <button
              key={t}
              onClick={() => onPick(t, note)}
              data-testid={`schedule-pick-${t}`}
              className={`py-3 rounded-xl text-white font-semibold text-sm ${SCHEDULE_TYPE_META[t].bg} ${
                day.dayType === t ? "ring-2 ring-white/70" : ""
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
          <button
            onClick={() => onSaveNote(note)}
            disabled={!noteChanged}
            className="self-end px-3 py-1.5 rounded-lg bg-gray-700 active:bg-gray-600 disabled:opacity-40 text-white text-xs font-semibold"
            data-testid="schedule-save-note"
          >
            Save Note
          </button>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl bg-gray-700 active:bg-gray-600 text-white font-semibold text-sm"
            data-testid="schedule-cancel"
          >
            Cancel
          </button>
          <button
            onClick={onClear}
            disabled={!day.dayType && !day.note}
            className="flex-1 py-2.5 rounded-xl bg-gray-700 active:bg-gray-600 disabled:opacity-40 text-white font-semibold text-sm"
            data-testid="schedule-clear"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}

