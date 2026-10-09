import { useMemo, type ReactNode } from "react";
import { buildCalendar, calendarMonthLabels } from "../../lib/progressData";
import type { CalendarDay } from "../../lib/progressData";
import type { SessionRecord } from "../../lib/history";
import type { ClimbRecord } from "../../lib/climbs";
import { toLocalDateString } from "../../lib/dates";
import { LegendItem, SectionHeading } from "./parts";

/**
 * One heatmap cell. Each activity bucket present that day contributes an equal
 * slice: 1 → solid, 2 → halves, 3 → thirds, 4 → quarters (2×2). This keeps every
 * bucket visible on shared days instead of one masking the others.
 */
function CalendarCell({ day, onSelect }: { day: CalendarDay; onSelect: () => void }) {
  const segments: { key: string; color: string; label: string }[] = [];
  if (day.gym) segments.push({ key: "gym", color: "bg-amber-500", label: "gym" });
  if (day.cardio) segments.push({ key: "cardio", color: "bg-rose-500", label: "cardio" });
  if (day.stretching) segments.push({ key: "stretching", color: "bg-violet-500", label: "stretching" });
  if (day.outdoor) segments.push({ key: "outdoor", color: "bg-teal-600", label: "outdoor" });

  const active = segments.length > 0;
  const title = active
    ? `${day.date.toLocaleDateString()}: ${segments.map((s) => s.label).join(" + ")}`
    : day.isToday
      ? "Today"
      : undefined;

  let inner: ReactNode = null;
  if (segments.length === 4) {
    inner = (
      <div className="grid grid-cols-2 grid-rows-2 w-full h-full">
        {segments.map((s) => (
          <div key={s.key} className={s.color} />
        ))}
      </div>
    );
  } else if (segments.length > 0) {
    inner = (
      <div className="flex w-full h-full">
        {segments.map((s) => (
          <div key={s.key} className={`flex-1 ${s.color}`} />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`w-3 h-3 rounded-sm overflow-hidden ${active ? "cursor-pointer" : "bg-gray-800"} ${
        day.isToday ? "ring-1 ring-white ring-offset-1 ring-offset-gray-800" : ""
      }`}
      onClick={active ? onSelect : undefined}
      title={title}
    >
      {inner}
    </div>
  );
}

type Props = {
  sessions: SessionRecord[];
  climbs: ClimbRecord[];
  /** Local date key (yyyy-mm-dd) of the tapped day. */
  onSelectDate: (date: string) => void;
};

/** The Activity heatmap: one cell per day, coloured by what was logged. */
export function OverviewCalendar({ sessions, climbs, onSelectDate }: Props) {
  const climbDateSet = useMemo(() => new Set(climbs.map((c) => c.date)), [climbs]);
  const calendarWeeks = useMemo(
    () => buildCalendar(sessions, climbDateSet),
    [sessions, climbDateSet],
  );
  const monthLabels = useMemo(() => calendarMonthLabels(calendarWeeks), [calendarWeeks]);

  return (
    <section className="flex flex-col gap-2.5">
      <SectionHeading>Activity</SectionHeading>
      <div className="bg-gray-800 rounded-2xl px-4 py-3">
        <div className="flex gap-1 mb-1 ml-5">
          {monthLabels.map((label, i) => (
            <div key={i} className="w-3 text-[9px] text-gray-500 text-center leading-none">
              {label}
            </div>
          ))}
        </div>

        <div className="flex gap-1">
          <div className="flex flex-col gap-1 mr-1 mt-0.5">
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
              <div key={i} className="text-gray-600 text-[9px] h-3 flex items-center w-3 justify-center">
                {d}
              </div>
            ))}
          </div>
          {calendarWeeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1">
              {week.map((day, di) => (
                <CalendarCell
                  key={di}
                  day={day}
                  onSelect={() => onSelectDate(toLocalDateString(day.date))}
                />
              ))}
            </div>
          ))}
        </div>

        <div className="flex gap-x-4 gap-y-1 mt-3 pt-3 border-t border-gray-700/60 flex-wrap">
          <LegendItem color="bg-teal-600" label="Outdoor" />
          <LegendItem color="bg-amber-500" label="Gym" />
          <LegendItem color="bg-rose-500" label="Cardio" />
          <LegendItem color="bg-violet-500" label="Stretching" />
        </div>
      </div>
    </section>
  );
}
