import { useEffect, useRef, useState } from "react";
import { ascentSummary, climbStyleLabel, getStyleColor, isTrad, styleBadgeClass } from "../../../lib/climbUtils";
import { routeStars, routeUrl, type ClimbRecord } from "../../../lib/climbs";
import { deduplicateForPyramid } from "../../../lib/deduplication";
import { MountainProjectLink } from "../../MountainProjectLink";
import { STONE_EDGE } from "../stone";
import { formatDateKey } from "../../../lib/dates";
import { frenchGrade } from "../../../lib/climbGradeUtils";
import { ordinal } from "../../../lib/format";

type Props = {
  climb: ClimbRecord | null;
  allClimbs: ClimbRecord[];
  /** The climbs to swipe through (the tapped grade row, oldest first). */
  siblings?: ClimbRecord[];
  /** Whose climbs these are when they're a friend's; labels their star rating. */
  climberName?: string;
  onNavigate?: (c: ClimbRecord) => void;
  onClose: () => void;
};

/** Horizontal finger travel (px) that commits a swipe. */
const SWIPE_PX = 60;
/** A quick flick commits a swipe even when it travels less. */
const FLICK_PX_PER_MS = 0.4;
/** Space between neighbouring cards in the carousel. */
const GAP = 16;
const SLIDE_MS = 220;
/** Fraction of the card's width, at each side, where a tap turns the page. */
const EDGE_TAP = 0.25;

type Dir = -1 | 1;

/**
 * The climb detail as a carousel: the neighbouring climbs at the same grade sit
 * either side of the open card, a swipe drags them in, and letting go slides
 * the whole strip so the new card arrives as its own card.
 */
export function ClimbDetailModal({ climb, allClimbs, siblings = [], climberName, onNavigate, onClose }: Props) {
  const index = climb ? siblings.findIndex((c) => c.id === climb.id) : -1;
  const canNavigate = !!onNavigate && index !== -1 && siblings.length > 1;
  const prev = canNavigate && index > 0 ? siblings[index - 1] : null;
  const next = canNavigate && index < siblings.length - 1 ? siblings[index + 1] : null;

  const viewportRef = useRef<HTMLDivElement>(null);
  // Strip offset from the centred position, in px. `sliding` turns on the CSS
  // transition (release and button presses); a finger drag moves it directly.
  const [offset, setOffset] = useState(0);
  const [sliding, setSliding] = useState(false);
  const busy = useRef(false);
  const touch = useRef<{ x: number; y: number; t: number; horizontal: boolean | null } | null>(null);

  const step = () => (viewportRef.current?.clientWidth ?? 0) + GAP;

  const settle = (to: number, after?: () => void) => {
    busy.current = true;
    setSliding(true);
    setOffset(to);
    window.setTimeout(() => {
      // Navigate and recentre in one render: the incoming card keeps its key,
      // so it is already the element sitting in the middle slot.
      after?.();
      setSliding(false);
      setOffset(0);
      busy.current = false;
    }, SLIDE_MS);
  };

  const go = (dir: Dir) => {
    const target = dir === 1 ? next : prev;
    if (!target || busy.current) return;
    settle(-dir * step(), () => onNavigate?.(target));
  };

  // Re-subscribed every render so the handler always sees the current neighbours.
  useEffect(() => {
    if (!climb) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!climb) return null;

  const onTouchStart = (e: React.TouchEvent) => {
    if (!canNavigate || busy.current || e.touches.length !== 1) return;
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY, t: e.timeStamp, horizontal: null };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const start = touch.current;
    if (!start) return;
    const t = e.touches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    // Lock direction after a little travel so vertical scrolling stays possible.
    if (start.horizontal === null && Math.hypot(dx, dy) > 8) {
      start.horizontal = Math.abs(dx) > Math.abs(dy);
    }
    if (start.horizontal) {
      // Rubber-band at the ends, where there is no card to pull in.
      const atEnd = (dx > 0 && !prev) || (dx < 0 && !next);
      setOffset(atEnd ? dx / 4 : dx);
    }
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start?.horizontal) return;
    const dx = offset;
    const fast = Math.abs(dx) / Math.max(1, e.timeStamp - start.t) > FLICK_PX_PER_MS;
    const commit = Math.abs(dx) >= SWIPE_PX || (fast && Math.abs(dx) > 20);
    if (commit && dx < 0 && next) go(1);
    else if (commit && dx > 0 && prev) go(-1);
    else settle(0);
  };

  const moving = offset !== 0 || sliding;
  const slots: { climb: ClimbRecord | null; key: string; role: "prev" | "current" | "next" }[] = [
    { climb: prev, key: prev?.id ?? "empty-prev", role: "prev" },
    { climb, key: climb.id, role: "current" },
    { climb: next, key: next?.id ?? "empty-next", role: "next" },
  ];

  return (
    // Cards hang from a fixed top edge, so swiping between climbs of different
    // heights changes only where each card ends, not where it starts.
    // Tapping the dimmed backdrop (anywhere off the card) closes it.
    <div
      className="fixed inset-0 bg-black/70 flex items-start justify-center px-4 pt-[12dvh] pb-4 z-50 overflow-hidden"
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest("[data-climb-card]")) onClose();
      }}
    >
      <div ref={viewportRef} className="max-w-lg w-full max-h-full flex">
        <div
          className="flex items-start w-full max-h-full"
          style={{
            gap: GAP,
            touchAction: canNavigate ? "pan-y" : undefined,
            transform: `translateX(calc(-100% - ${GAP}px + ${offset}px))`,
            transition: sliding ? `transform ${SLIDE_MS}ms cubic-bezier(0.2, 0.7, 0.3, 1)` : undefined,
          }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchEnd}
        >
          {slots.map((slot) => {
            const isCurrent = slot.role === "current";
            const slotIndex = slot.climb ? siblings.findIndex((c) => c.id === slot.climb!.id) : -1;
            return (
              <div
                key={slot.key}
                aria-hidden={!isCurrent}
                inert={!isCurrent}
                className="w-full shrink-0 max-h-[calc(88dvh-1rem)] flex"
                // Neighbours are only shown while the strip moves; on a wide
                // screen they would otherwise sit beside the open card.
                style={{ visibility: isCurrent || moving ? "visible" : "hidden" }}
              >
                {slot.climb && (
                  <ClimbCard
                    climb={slot.climb}
                    allClimbs={allClimbs}
                    climberName={climberName}
                    position={canNavigate && slotIndex !== -1 ? { index: slotIndex, count: siblings.length } : null}
                    onClose={onClose}
                    onEdgeTap={isCurrent && canNavigate ? go : undefined}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

type CardProps = {
  climb: ClimbRecord;
  allClimbs: ClimbRecord[];
  climberName?: string;
  position: { index: number; count: number } | null;
  /** Tap on the card's left/right edge, like turning a page in an e-reader. */
  onEdgeTap?: (dir: Dir) => void;
  onClose: () => void;
};

function ClimbCard({ climb: tapped, allClimbs, climberName, position, onEdgeTap, onClose }: CardProps) {
  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onEdgeTap) return;
    // Buttons keep their own meaning; only taps on plain content turn the page.
    if ((e.target as HTMLElement).closest("button, a, input, textarea, select")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    if (x < EDGE_TAP) onEdgeTap(-1);
    else if (x > 1 - EDGE_TAP) onEdgeTap(1);
  };

  const routeHistory = allClimbs
    .filter((c) => c.route === tapped.route)
    .sort((a, b) => b.date.localeCompare(a.date));
  // The card is about the route, whichever tile opened it: a timeline day shows
  // the same card as the route's pyramid tile (its send, what the send took).
  const climb =
    deduplicateForPyramid(routeHistory).find(
      (r) => r.location === tapped.location && r.type === tapped.type && r.setting === tapped.setting,
    ) ?? tapped;
  const url = climb.url ?? routeUrl(routeHistory);
  const { stars, avgStars } = routeStars([climb, ...routeHistory]);
  const summary = ascentSummary(climb, routeHistory);

  return (
    <div className="bg-gray-800 rounded-2xl w-full overflow-y-auto overscroll-contain" data-climb-card onClick={onClick}>
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-bold text-white">{climb.route}</h3>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
              <span className="font-num text-xl text-white">{climb.grade}</span>
              {climb.type === "sport" && frenchGrade(climb.grade) && (
                <span className="font-num text-xl text-gray-500" title="Approximate French grade">
                  {frenchGrade(climb.grade)}
                </span>
              )}
              <span className="text-sm text-gray-400">
                · {climb.type === "boulder" ? "Boulder" : isTrad(climb) ? "Trad" : "Sport"}
              </span>
              {/* Where this climb sits in its grade row; swipe, tap an edge or use arrow keys to move. */}
              {position && (
                <span className="text-sm text-gray-500">
                  (<span className="font-num">{ordinal(position.index + 1)}</span> of{" "}
                  <span className="font-num">{position.count}</span>)
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="-mr-2 -mt-1 px-2 text-gray-500 hover:text-white text-2xl">
            &times;
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 -mt-2 text-sm text-gray-400" data-testid="climb-stars">
            {/* Unrated shows four empty stars. */}
            <StarRow
              value={stars ?? 0}
              label={`${climberName ? `${climberName}’s` : "Your"} rating: ${stars === undefined ? "not rated" : `${stars} of 4 stars`}`}
            />
            {avgStars !== undefined && (
              <>
                <span aria-hidden>·</span>
                <span title="Mountain Project average">
                  <span className="font-num text-base text-gray-200">{avgStars.toFixed(1)}</span> avg
                </span>
              </>
            )}
          </div>

          {/* The ascent: style icon (its colour is the style), date, and what it took. */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-400">
            <span
              role="img"
              aria-label={climbStyleLabel({ style: climb.style, climbs: 1 })}
              title={climbStyleLabel({ style: climb.style, climbs: 1 })}
              className={`w-3 h-3 shrink-0 ${isTrad(climb) ? "rounded-full" : "rounded-[3px]"} ${getStyleColor(climb.style)}`}
              style={{ boxShadow: STONE_EDGE }}
            />
            <span className="text-gray-200">{formatDateKey(climb.date)}</span>
            {summary && <span>{summary}</span>}
          </div>

          <div>
            {climb.location && <p className="text-gray-200">{climb.location}</p>}
            {url && <MountainProjectLink url={url} className="mt-1" />}
          </div>

          {/* With several sessions each note sits in its own row below. */}
          {routeHistory.length <= 1 && climb.notes && <p className="text-gray-200 whitespace-pre-wrap">{climb.notes}</p>}
        </div>

        {routeHistory.length > 1 && (
          <div className="mt-4 border-t border-gray-700 pt-4">
            <p className="text-sm font-medium text-gray-500 mb-2">Sessions ({routeHistory.length})</p>
            <div className="flex flex-col gap-2">
              {routeHistory.map((c) => {
                const styleLabel = climbStyleLabel(c);
                return (
                  <div key={c.id} className={`rounded px-2 py-1 ${c.id === tapped.id ? "bg-gray-700/60" : ""}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-300 text-xs flex-1">
                        {formatDateKey(c.date)}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${styleBadgeClass(c.style)}`}>
                        {styleLabel}
                      </span>
                    </div>
                    {c.notes && <p className="mt-0.5 text-sm text-gray-200 whitespace-pre-wrap">{c.notes}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const STAR_PATH =
  "M10 1.5l2.6 5.3 5.9.9-4.25 4.1 1 5.85L10 14.9l-5.25 2.75 1-5.85L1.5 7.7l5.9-.9z";

/**
 * Four stars, filled to `value` (0–4) in quarter steps, so an average of 3.4
 * shows a little under three and a half. Gray-on-gray: stars are information,
 * not something to tap, so they stay out of the accent colour.
 */
function StarRow({ value, label }: { value: number; label: string }) {
  const quarters = Math.round(value * 4) / 4;
  return (
    <div className="flex items-center gap-0.5 py-0.5" role="img" aria-label={label}>
      {[0, 1, 2, 3].map((i) => {
        const fill = Math.min(1, Math.max(0, quarters - i));
        return (
          <svg key={i} viewBox="0 0 20 20" className="w-4 h-4" aria-hidden>
            <path d={STAR_PATH} className="fill-gray-600" />
            {fill > 0 && (
              <path
                d={STAR_PATH}
                className="fill-gray-100"
                style={fill < 1 ? { clipPath: `inset(0 ${(1 - fill) * 100}% 0 0)` } : undefined}
              />
            )}
          </svg>
        );
      })}
    </div>
  );
}
