import { recordStore } from "./db";
import { fetchTickExport } from "./mpFetch";
import type { ClimbRecord } from "./climbs";
import type { MpUser } from "./mpAccount";

/**
 * A friend whose Mountain Project ticks are kept on this device to look at.
 *
 * Their ticks live inside the record, never in the `climbs` store: that store
 * is the user's own log and feeds History, the calendar and the Schedule.
 */
export type FriendRecord = {
  /** Mountain Project user id. */
  id: string;
  name: string;
  tickExportUrl: string;
  addedAt: number;
  /** When `climbs` was last fetched; null for a friend restored from a backup. */
  fetchedAt: number | null;
  climbs: ClimbRecord[];
};

/** What a backup keeps of a friend. Ticks are left out; they can be fetched again. */
export type FriendRef = Pick<FriendRecord, "id" | "name" | "tickExportUrl" | "addedAt">;

/** A friend's ticks are refetched when the copy is older than this. */
export const FRIEND_STALE_MS = 24 * 60 * 60 * 1000;

const friends = recordStore<FriendRecord>("friends");

export const getFriend = friends.get;
export const removeFriend = friends.remove;

/** Every friend, in the order they were added. */
export async function getFriends(): Promise<FriendRecord[]> {
  return (await friends.all()).sort((a, b) => a.addedAt - b.addedAt);
}

export function isFriendStale(friend: FriendRecord, now: number = Date.now()): boolean {
  return friend.fetchedAt === null || now - friend.fetchedAt > FRIEND_STALE_MS;
}

export function toFriendRef({ id, name, tickExportUrl, addedAt }: FriendRecord): FriendRef {
  return { id, name, tickExportUrl, addedAt };
}

/** A friend restored from a backup: known, but with no ticks until the next fetch. */
export function friendFromRef(ref: FriendRef): FriendRecord {
  return { ...ref, fetchedAt: null, climbs: [] };
}

function fetchFor(name: string, exportUrl: string): Promise<ClimbRecord[]> {
  return fetchTickExport(exportUrl, `${name}'s ticks may be private.`);
}

/**
 * Add a Mountain Project user as a friend. Their ticks are fetched first, so a
 * private or empty account is refused instead of being stored as a blank.
 */
export async function addFriend(user: MpUser): Promise<FriendRecord> {
  const existing = await friends.get(user.id);
  const climbs = await fetchFor(user.name, user.tickExportUrl);
  const friend: FriendRecord = {
    id: user.id,
    name: user.name,
    tickExportUrl: user.tickExportUrl,
    addedAt: existing?.addedAt ?? Date.now(),
    fetchedAt: Date.now(),
    climbs,
  };
  await friends.put(friend);
  return friend;
}

/** Refetch a friend's ticks. A failed fetch leaves the stored copy as it was. */
export async function refreshFriend(id: string): Promise<FriendRecord> {
  const friend = await friends.get(id);
  if (!friend) throw new Error("That friend is no longer saved.");
  const climbs = await fetchFor(friend.name, friend.tickExportUrl);
  const updated: FriendRecord = { ...friend, climbs, fetchedAt: Date.now() };
  // Removed while the fetch was in flight: don't bring them back.
  if (!(await friends.get(id))) throw new Error("That friend is no longer saved.");
  await friends.put(updated);
  return updated;
}

/** "3 hours ago" for a friend's last fetch. */
export function fetchedAgo(fetchedAt: number | null, now: number = Date.now()): string {
  if (fetchedAt === null) return "not loaded yet";
  const mins = Math.floor((now - fetchedAt) / 60000);
  if (mins < 1) return "updated just now";
  if (mins < 60) return `updated ${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `updated ${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `updated ${days} day${days === 1 ? "" : "s"} ago`;
}
