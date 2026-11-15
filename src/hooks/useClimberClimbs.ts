import { useCallback, useState } from "react";
import { useLoad } from "./useLoad";
import { getClimbs } from "../lib/climbs";
import type { ClimbRecord } from "../lib/climbs";
import { getFriends } from "../lib/friends";
import type { FriendRecord } from "../lib/friends";

type Loaded = { own: ClimbRecord[]; friends: FriendRecord[] };

const NOTHING: Loaded = { own: [], friends: [] };
const NO_CLIMBS: ClimbRecord[] = [];

async function loadAll(): Promise<Loaded> {
  const [own, friends] = await Promise.all([getClimbs(), getFriends()]);
  return { own, friends };
}

/**
 * The climbs a pyramid screen should draw: your own, or those of the friend
 * whose id is `who`. `missing` is true when `who` names a friend who isn't
 * saved (removed, or a stale link), so the screen can fall back to you.
 */
export function useClimberClimbs(who: string | undefined) {
  const [version, setVersion] = useState(0);
  const { data, loading } = useLoad(loadAll, NOTHING, [version]);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  const friend = who === undefined ? undefined : data.friends.find((f) => f.id === who);
  const climbs = who === undefined ? data.own : friend?.climbs ?? NO_CLIMBS;
  return {
    friends: data.friends,
    friend,
    climbs,
    loading,
    missing: !loading && who !== undefined && !friend,
    reload,
  };
}
