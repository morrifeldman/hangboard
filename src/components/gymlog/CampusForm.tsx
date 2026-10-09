import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  CAMPUS_RUNGS,
  CAMPUS_NAMES,
  sequenceShortLabel,
  shortCodeToSequence,
  ladderDisplayName,
  rungShortLabel,
} from "../../data/gymWorkouts";
import type { CampusSet } from "../../lib/history";
import { campusTemplateRows, emptyCampusRow, formatMMSS, parseDurationInput, sequenceOptionsFor } from "../../lib/gymForm";
import type { CampusRow } from "../../lib/gymForm";
import { Audio, initAudio } from "../../lib/audio";
import { Haptics } from "../../lib/haptics";
import { ClockIcon, NoteIcon } from "../icons";

// Standalone rest countdown for campus sessions — no tie to the workout state machine.
// Just a configurable timer you reset between ladders; the chosen length persists.
const REST_KEY = "hangboard-campus-rest-secs";
const REST_PRESETS = [60, 90, 120, 180, 300];

function CampusRestTimer() {
  const [duration, setDuration] = useState<number>(() => {
    const saved = Number(localStorage.getItem(REST_KEY));
    return Number.isFinite(saved) && saved > 0 ? saved : 180;
  });
  const [remaining, setRemaining] = useState(duration);
  const [running, setRunning] = useState(false);
  const deadlineRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) {
        setRunning(false);
        Audio.restEnd();
        Haptics.setComplete();
      }
    }, 250);
    return () => clearInterval(id);
  }, [running]);

  const pickDuration = (secs: number) => {
    setDuration(secs);
    localStorage.setItem(REST_KEY, String(secs));
    setRunning(false);
    setRemaining(secs);
  };

  const toggle = () => {
    if (running) {
      setRunning(false);
      return;
    }
    initAudio(); // unlock the AudioContext inside this user gesture
    Audio.restStart();
    Haptics.hangStart();
    const from = remaining > 0 ? remaining : duration;
    deadlineRef.current = Date.now() + from * 1000;
    setRemaining(from);
    setRunning(true);
  };

  const reset = () => {
    setRunning(false);
    setRemaining(duration);
  };

  const done = !running && remaining === 0;

  return (
    <div className="bg-gray-800 rounded-2xl p-3 flex flex-col gap-2.5">
      <div className="flex items-center gap-3">
        <ClockIcon size={18} className="text-gray-500 shrink-0" />
        <span
          className={`font-num text-3xl ${
            done ? "text-accent-400" : "text-white"
          }`}
        >
          {formatMMSS(remaining)}
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={toggle}
          aria-label={running ? "Pause rest timer" : "Start rest timer"}
          className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-accent-500 text-gray-900 text-lg hover:bg-accent-400 transition-colors"
        >
          {running ? "⏸" : "▶"}
        </button>
        <button
          type="button"
          onClick={reset}
          aria-label="Reset rest timer"
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full border border-gray-600 text-gray-400 hover:text-white text-base"
        >
          ↺
        </button>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {REST_PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => pickDuration(p)}
            aria-pressed={duration === p}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
              duration === p
                ? "bg-accent-500 text-gray-900 border border-accent-500"
                : "text-gray-400 hover:text-white border border-gray-700"
            }`}
          >
            {formatMMSS(p)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            const v = window.prompt("Rest length — seconds or m:ss", formatMMSS(duration));
            if (v == null) return;
            const secs = parseDurationInput(v);
            if (secs != null && secs > 0) pickDuration(secs);
          }}
          aria-pressed={!REST_PRESETS.includes(duration)}
          className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
            !REST_PRESETS.includes(duration)
              ? "bg-accent-500 text-gray-900 border border-accent-500"
              : "text-gray-400 hover:text-white border border-gray-700"
          }`}
        >
          Custom…
        </button>
      </div>
    </div>
  );
}

type Props = {
  rows: CampusRow[];
  onChange: Dispatch<SetStateAction<CampusRow[]>>;
  /** Past sequences by ladder name, merged with the presets in the dropdown. */
  loggedSequences: Record<string, string[]>;
  /** Editing an old record: no "Reset to routine". */
  editing: boolean;
};

const SELECT_CLS =
  "bg-gray-700 text-white rounded-lg pl-2 pr-1 py-1.5 text-xs border border-gray-600 focus:outline-none focus:border-accent-500";

export function CampusForm({ rows, onChange, loggedSequences, editing }: Props) {
  // Rows whose fold-out note input is revealed, by row uid (seeded from rows that
  // already have a note). Keyed by uid so deleting a row can't move the toggle.
  const [noteOpen, setNoteOpen] = useState<Set<string>>(
    () => new Set(rows.filter((r) => r.note).map((r) => r.uid)),
  );
  // Reveal the full B/L/R hand-sequence code under each compact row.
  const [showCodes, setShowCodes] = useState(false);

  const setRow = (uid: string, patch: Partial<CampusSet>) =>
    onChange((prev) => prev.map((r) => (r.uid === uid ? { ...r, ...patch } : r)));
  const removeRow = (uid: string) => {
    onChange((prev) => prev.filter((r) => r.uid !== uid));
    setNoteOpen((prev) => {
      const next = new Set(prev);
      next.delete(uid);
      return next;
    });
  };
  const toggleNote = (uid: string) =>
    setNoteOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(uid)) next.add(uid);
      return next;
    });

  return (
    <div className="flex flex-col gap-3">
      <CampusRestTimer />
      <div className="bg-gray-800 rounded-2xl divide-y divide-gray-700/60">
        {rows.map((row) => {
          // Presets ∪ previously-saved ∪ sequences already used by same-Name rows
          // in this form — so a custom entry is instantly reusable across sibling sets.
          const seqOptions = Array.from(
            new Set([
              ...sequenceOptionsFor(row.name, loggedSequences),
              ...rows.filter((r) => r.name === row.name && r.sequence).map((r) => r.sequence),
            ]),
          );
          const nameOptions = Array.from(
            new Set([
              ...CAMPUS_NAMES,
              ...(row.name && !CAMPUS_NAMES.includes(row.name) ? [row.name] : []),
            ]),
          );
          const noteShown = noteOpen.has(row.uid);
          return (
            <div key={row.uid} className="px-2 py-2 flex flex-col gap-2">
              <div className="flex items-center gap-1.5">
                <select
                  value={row.rung}
                  onChange={(e) => setRow(row.uid, { rung: e.target.value })}
                  aria-label="Rung size"
                  title="Rung size"
                  className={`shrink-0 font-semibold ${SELECT_CLS}`}
                >
                  <option value="" disabled hidden>·</option>
                  {CAMPUS_RUNGS.map((r) => <option key={r} value={r}>{rungShortLabel(r)}</option>)}
                </select>
                <select
                  value={row.name}
                  onChange={(e) => setRow(row.uid, { name: e.target.value })}
                  aria-label="Ladder name"
                  className={`shrink-0 ${SELECT_CLS}`}
                >
                  <option value="" disabled hidden>Name</option>
                  {nameOptions.map((n) => <option key={n} value={n}>{ladderDisplayName(n)}</option>)}
                </select>
                <select
                  value={row.sequence}
                  onChange={(e) => {
                    if (e.target.value === "__custom__") {
                      const v = window.prompt(
                        "Hand sequence — full code (B1-L2-R2-…) or short code (e.g. R+1+2, L4)",
                        row.sequence,
                      );
                      if (v != null) {
                        const trimmed = v.trim();
                        setRow(row.uid, { sequence: shortCodeToSequence(trimmed) ?? trimmed });
                      }
                    } else {
                      setRow(row.uid, { sequence: e.target.value });
                    }
                  }}
                  aria-label="Hand sequence"
                  title={row.sequence || "Hand sequence"}
                  className={`flex-1 min-w-0 font-mono ${SELECT_CLS}`}
                >
                  <option value="" disabled hidden>Seq</option>
                  {seqOptions.map((s) => <option key={s} value={s}>{sequenceShortLabel(s)}</option>)}
                  <option value="__custom__">+ Custom…</option>
                </select>
                <button
                  type="button"
                  onClick={() => toggleNote(row.uid)}
                  aria-label={row.note ? "Edit set note" : "Add set note"}
                  title="Note"
                  className={`shrink-0 w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
                    row.note || noteShown
                      ? "text-accent-400 bg-accent-500/10"
                      : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  <NoteIcon size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => removeRow(row.uid)}
                  aria-label="Remove set"
                  className="shrink-0 text-gray-500 hover:text-red-400 text-lg leading-none w-6 h-7 flex items-center justify-center"
                >
                  ×
                </button>
              </div>
              {showCodes && row.sequence && (
                <p className="font-mono text-[0.7rem] text-gray-500 px-1 -mt-0.5 break-all">
                  {row.sequence}
                </p>
              )}
              {noteShown && (
                <input
                  type="text"
                  value={row.note ?? ""}
                  onChange={(e) => setRow(row.uid, { note: e.target.value })}
                  placeholder="Note"
                  aria-label="Set note"
                  autoFocus
                  className="w-full bg-gray-700/60 text-white rounded-lg px-2 py-1.5 text-xs placeholder-gray-500 border border-gray-700 focus:outline-none focus:border-accent-500"
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => onChange((prev) => [...prev, emptyCampusRow()])}
          className="text-xs font-semibold text-gray-400 hover:text-white px-3 py-1.5 rounded-full border border-gray-700 bg-gray-800"
        >
          + Add set
        </button>
        <div className="flex-1" />
        {!editing && (
          <button
            type="button"
            onClick={() => onChange(campusTemplateRows())}
            className="text-sm font-medium text-accent-400 hover:text-accent-300 px-2 py-1.5"
          >
            Reset to routine
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowCodes((v) => !v)}
          aria-pressed={showCodes}
          className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
            showCodes
              ? "text-white bg-gray-700 border-gray-600"
              : "text-gray-400 hover:text-white border-gray-700 bg-gray-800"
          }`}
        >
          {showCodes ? "Hide codes" : "Show codes"}
        </button>
      </div>
    </div>
  );
}
