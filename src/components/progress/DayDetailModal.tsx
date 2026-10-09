import { useState } from "react";
import { RouteHistoryModal } from "../RouteHistoryModal";
import { warmupVolume } from "../../data/holds";
import { isWarmupHoldId } from "../../data/workout-b";
import { formatWeight, shortLocation } from "../../lib/format";
import { toLocalDateString } from "../../lib/dates";
import { sessionLabel, gymSummaryParts, summaryText } from "../../lib/sessionSummary";
import type { SessionRecord } from "../../lib/history";
import type { ClimbRecord } from "../../lib/climbs";
import type { NoteRecord } from "../../lib/notes";

function climbStyleBadge(style: ClimbRecord["style"]): string {
  if (style === "onsight") return "bg-green-500/20 text-green-400";
  if (style === "flash") return "bg-yellow-500/20 text-yellow-400";
  if (style === "redpoint") return "bg-red-500/20 text-red-400";
  return "bg-gray-700 text-gray-400";
}

type Props = {
  /** Local date key (yyyy-mm-dd). */
  date: string;
  sessions: SessionRecord[];
  climbs: ClimbRecord[];
  notes: NoteRecord[];
  onClose: () => void;
  onEditSession: (record: SessionRecord) => void;
};

/** Bottom sheet listing everything logged on one calendar day. */
export function DayDetailModal({ date, sessions, climbs, notes, onClose, onEditSession }: Props) {
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);

  const dayClimbs = climbs.filter((c) => c.date === date);
  const daySessions = sessions.filter((s) => toLocalDateString(new Date(s.startedAt)) === date);
  const dayNotes = notes.filter((n) => n.date === date);

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900 rounded-t-2xl z-50 max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-800 sticky top-0 bg-gray-900">
          <h2 className="text-white font-semibold">
            {new Date(date + "T12:00:00").toLocaleDateString("en-US", {
              weekday: "short", month: "short", day: "numeric", year: "numeric",
            })}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-white p-1 -mr-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Notes section */}
        {dayNotes.length > 0 && (
          <div className="px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-300 mb-2">Notes</h3>
            <div className="flex flex-col gap-2.5">
              {dayNotes.map((note) => (
                <div key={note.id} className="flex flex-col gap-1">
                  {note.category && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium self-start bg-purple-500/20 text-purple-300">
                      {note.category}
                    </span>
                  )}
                  <p className="text-sm text-gray-200 whitespace-pre-wrap break-words">{note.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Climbs section */}
        {dayClimbs.length > 0 && (
          <div className="px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-300 mb-2">Climbing</h3>
            <div className="flex flex-col gap-2.5">
              {dayClimbs.map((climb) => (
                <button
                  key={climb.id}
                  className="flex items-start justify-between gap-2 text-left w-full hover:bg-gray-800 rounded-lg px-2 py-1 -mx-2 transition-colors"
                  onClick={() => setSelectedRoute(climb.route)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white text-sm font-medium">{climb.route}</span>
                      <span className="text-gray-300 text-[15px] font-num">{climb.grade}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${climbStyleBadge(climb.style)}`}>
                        {climb.style}
                      </span>
                    </div>
                    {climb.notes && (
                      <p className="text-gray-500 text-xs italic mt-0.5">{climb.notes}</p>
                    )}
                  </div>
                  <span className="text-gray-500 text-xs text-right shrink-0 mt-0.5">
                    {shortLocation(climb.location)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Workout sections */}
        {daySessions.map((session) => (
          <div key={session.id} className="px-4 py-3 border-t border-gray-800">
            <div className="flex items-center justify-between mb-2">
              <button
                className="text-sm font-semibold text-gray-300 hover:text-white transition-colors text-left"
                onClick={() => onEditSession(session)}
              >
                {sessionLabel(session)}
              </button>
              <div className="flex items-center gap-2">
                {session.bailed && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">Bailed</span>
                )}
                <span className="text-gray-500 text-xs">
                  {new Date(session.startedAt).toLocaleTimeString("en-US", {
                    hour: "numeric", minute: "2-digit",
                  })}
                </span>
              </div>
            </div>

            {session.holds.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {session.holds.some((h) => isWarmupHoldId(h.holdId)) && (
                  <div className="-mx-2 mb-1 rounded-lg bg-teal-400/[0.06] px-2 py-1.5">
                    <p className="mb-1 text-xs font-semibold text-teal-300/80">
                      Warm-up
                    </p>
                    <div className="flex flex-col gap-1">
                      {session.holds.filter((h) => isWarmupHoldId(h.holdId)).map((hold) => {
                        const sets = [hold.set1, hold.set2, hold.set3].filter((x) => x != null);
                        const done = sets.every((x) => x.completed);
                        return (
                          <div key={hold.holdId} className="flex items-center justify-between gap-3">
                            <span className={`text-sm truncate ${done ? "text-gray-300" : "text-gray-500 line-through"}`}>
                              {hold.holdName}
                            </span>
                            <span className="text-xs font-medium tabular-nums text-teal-300/90">
                              {warmupVolume(sets.map((x) => x.reps))}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {session.holds.filter((h) => !isWarmupHoldId(h.holdId)).map((hold) => (
                  <div key={hold.holdId} className="flex items-center justify-between">
                    <span className="text-sm text-gray-200">{hold.holdName}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500">
                        S1 <span className={hold.set1.completed ? "text-gray-300" : "text-gray-500 line-through"}>{formatWeight(hold.set1.weight)}</span>
                      </span>
                      {hold.set2 && (
                        <span className="text-xs text-gray-500">
                          S2 <span className={hold.set2.completed ? "text-gray-300" : "text-gray-500 line-through"}>{formatWeight(hold.set2.weight)}</span>
                        </span>
                      )}
                      {hold.set3 && (
                        <span className="text-xs text-gray-500">
                          S3 <span className={hold.set3.completed ? "text-gray-300" : "text-gray-500 line-through"}>{formatWeight(hold.set3.weight)}</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {session.gymData && (
              <p className="text-sm text-gray-400 mt-1">{summaryText(gymSummaryParts(session.gymData))}</p>
            )}

            {session.notes && (
              <p className="text-gray-500 text-xs italic mt-2">{session.notes}</p>
            )}
          </div>
        ))}

        <div className="h-8" />
      </div>

      {selectedRoute && (
        <RouteHistoryModal
          routeName={selectedRoute}
          allClimbs={climbs}
          onClose={() => setSelectedRoute(null)}
        />
      )}
    </>
  );
}
