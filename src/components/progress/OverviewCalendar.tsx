import { useMemo, useState, type ReactNode } from "react";
import { buildCalendar, calendarMonthLabels } from "../../lib/progressData";
import type { CalendarDay } from "../../lib/progressData";
import type { SessionRecord } from "../../lib/history";
import type { ClimbRecord } from "../../lib/climbs";
import { toLocalDateString } from "../../lib/dates";
import { ACTIVITY_CATEGORIES } from "../../lib/sessionKind";
import { LegendItem, SectionHeading } from "./parts";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Cell size (px) normally and in the zoomed week. */
const CELL = 12;
const ZOOM_CELL = 28;
const GAP = 4;
/** Row pitch: when a week is zoomed every row grows so the days stay aligned. */
const rowHeightFor = (zoomed: boolean) => (zoomed ? ZOOM_CELL : CELL);

/**
 * One heatmap cell. Each activity category present that day contributes an
 * equal slice: 1 → solid, 2 → halves, 3 → thirds, 4 → quarters (2×2), 5+ →
 * strips. This keeps every category visible on shared days instead of one
 * masking the others.
 */
function CalendarCell({
  day,
  size,
  zoomed,
  onClick,
}: {
  day: CalendarDay;
  size: number;
  zoomed: boolean;
  onClick: () => void;
}) {
  const segments = ACTIVITY_CATEGORIES.filter((c) => day.categories.includes(c.id)).map((c) => ({
    key: c.id,
    color: c.color,
    label: c.label.toLowerCase(),
  }));

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
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={zoomed ? title ?? day.date.toLocaleDateString() : `Zoom week of ${day.date.toLocaleDateString()}`}
      className={`relative shrink-0 overflow-hidden appearance-none border-0 p-0 cursor-pointer transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 ${
        active ? "" : zoomed ? "bg-gray-700" : "bg-gray-800"
      } ${day.isToday ? "ring-1 ring-white ring-offset-1 ring-offset-gray-800" : ""}`}
      style={{ width: size, height: size, borderRadius: zoomed ? 6 : 2 }}
    >
      {inner}
      {zoomed && (
        <span
          className={`absolute inset-0 flex items-center justify-center font-num text-[12px] leading-none ${
            active ? "text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.6)]" : "text-gray-400"
          }`}
        >
          {day.date.getDate()}
        </span>
      )}
    </button>
  );
}

type Props = {
  sessions: SessionRecord[];
  climbs: ClimbRecord[];
  /** Local date key (yyyy-mm-dd) of the tapped day. */
  onSelectDate: (date: string) => void;
};

/**
 * The Activity heatmap: one cell per day, coloured by what was logged.
 *
 * Tapping a week (its header or any of its days) zooms that column to full
 * size with day numbers, like tapping a grade on the pyramid. In the zoomed
 * week, a logged day opens its detail; an empty day or the header collapses.
 */
export function OverviewCalendar({ sessions, climbs, onSelectDate }: Props) {
  const calendarWeeks = useMemo(() => buildCalendar(sessions, climbs), [sessions, climbs]);
  const monthLabels = useMemo(() => calendarMonthLabels(calendarWeeks), [calendarWeeks]);
  const [zoomedWeek, setZoomedWeek] = useState<number | null>(null);

  const rowHeight = rowHeightFor(zoomedWeek !== null);
  const toggleWeek = (wi: number) => setZoomedWeek((w) => (w === wi ? null : wi));

  const zoomed = zoomedWeek !== null ? calendarWeeks[zoomedWeek] : null;
  const zoomedActiveDays = zoomed ? zoomed.filter((d) => d.categories.length > 0).length : 0;

  return (
    <section className="flex flex-col gap-2.5">
      <SectionHeading>Activity</SectionHeading>
      <div className="bg-gray-800 rounded-2xl px-4 py-3">
        <div className="flex">
          {/* Weekday labels */}
          <div className="flex flex-col mr-1" style={{ gap: GAP, marginTop: 9 + GAP }}>
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
              <div
                key={i}
                className="text-gray-600 text-[9px] flex items-center w-3 justify-center transition-all duration-200"
                style={{ height: rowHeight }}
              >
                {d}
              </div>
            ))}
          </div>

          <div className="flex" style={{ gap: GAP }}>
            {calendarWeeks.map((week, wi) => {
              const isZoomed = zoomedWeek === wi;
              const size = isZoomed ? ZOOM_CELL : CELL;
              const monday = week[0].date;
              return (
                <div key={wi} className="flex flex-col items-center" style={{ gap: GAP }}>
                  <button
                    type="button"
                    onClick={() => toggleWeek(wi)}
                    aria-label={isZoomed ? "Collapse week" : `Zoom week of ${monday.toLocaleDateString()}`}
                    className={`h-[9px] text-[9px] leading-none whitespace-nowrap appearance-none border-0 bg-transparent p-0 cursor-pointer transition-all duration-200 ${
                      isZoomed ? "text-accent-300" : "text-gray-500"
                    }`}
                    style={{ width: size }}
                  >
                    {isZoomed ? `${MONTHS[monday.getMonth()]} ${monday.getDate()}` : monthLabels[wi]}
                  </button>
                  {week.map((day, di) => (
                    <div
                      key={di}
                      className="flex items-center transition-all duration-200"
                      style={{ height: rowHeight }}
                    >
                      <CalendarCell
                        day={day}
                        size={size}
                        zoomed={isZoomed}
                        onClick={() => {
                          if (!isZoomed) setZoomedWeek(wi);
                          else if (day.categories.length > 0) onSelectDate(toLocalDateString(day.date));
                          else setZoomedWeek(null);
                        }}
                      />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-[11px] text-gray-500 mt-2 h-4">
          {zoomed
            ? `${zoomedActiveDays} active day${zoomedActiveDays === 1 ? "" : "s"} · tap a day for details`
            : "Tap a week to zoom in"}
        </p>

        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2 pt-3 border-t border-gray-700/60">
          {ACTIVITY_CATEGORIES.map((c) => (
            <LegendItem key={c.id} color={c.color} label={c.label} />
          ))}
        </div>
      </div>
    </section>
  );
}
