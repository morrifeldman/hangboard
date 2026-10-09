import { useEffect, useState } from "react";
import { getSessions } from "../lib/history";
import type { SessionRecord } from "../lib/history";
import { getClimbs } from "../lib/climbs";
import type { ClimbRecord } from "../lib/climbs";
import { getNotes } from "../lib/notes";
import type { NoteRecord } from "../lib/notes";

/**
 * Load data once on mount (and again when `deps` change). A result that
 * arrives after unmount, or after a newer load started, is dropped; a failure
 * is logged and leaves `data` at `initial` with `loading` false.
 */
export function useLoad<T>(load: () => Promise<T>, initial: T, deps: readonly unknown[] = []) {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let current = true;
    load()
      .then((d) => {
        if (current) setData(d);
      })
      .catch(console.error)
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
    // `load` is usually an inline closure; `deps` says when to reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { data, setData, loading };
}

export type HistoryData = { sessions: SessionRecord[]; climbs: ClimbRecord[]; notes: NoteRecord[] };

const EMPTY_HISTORY: HistoryData = { sessions: [], climbs: [], notes: [] };

async function loadHistory(): Promise<HistoryData> {
  const [sessions, climbs, notes] = await Promise.all([getSessions(), getClimbs(), getNotes()]);
  return { sessions, climbs, notes };
}

/** Everything the user has logged, newest first. */
export function useHistoryData() {
  return useLoad(loadHistory, EMPTY_HISTORY);
}
