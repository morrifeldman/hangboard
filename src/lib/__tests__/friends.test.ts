import { describe, expect, it } from "vitest";
import { FRIEND_STALE_MS, fetchedAgo, friendFromRef, isFriendStale, toFriendRef } from "../friends";
import type { FriendRecord } from "../friends";
import { buildBackup, validateBackup } from "../backup";

const NOW = 1_700_000_000_000;

const FRIEND: FriendRecord = {
  id: "111",
  name: "Ada Climber",
  tickExportUrl: "https://www.mountainproject.com/user/111/ada-climber/tick-export",
  addedAt: NOW - 5000,
  fetchedAt: NOW - 1000,
  climbs: [
    {
      id: "c1",
      route: "Power Surge",
      grade: "5.12a",
      location: "Somewhere",
      type: "sport",
      setting: "outdoor",
      style: "redpoint",
      climbs: 1,
      date: "2024-03-15",
      notes: "",
    },
  ],
};

describe("isFriendStale", () => {
  it("is fresh within a day and stale after", () => {
    expect(isFriendStale(FRIEND, NOW)).toBe(false);
    expect(isFriendStale({ ...FRIEND, fetchedAt: NOW - FRIEND_STALE_MS }, NOW)).toBe(false);
    expect(isFriendStale({ ...FRIEND, fetchedAt: NOW - FRIEND_STALE_MS - 1 }, NOW)).toBe(true);
  });

  it("is stale when never fetched", () => {
    expect(isFriendStale({ ...FRIEND, fetchedAt: null }, NOW)).toBe(true);
  });
});

describe("fetchedAgo", () => {
  it("words the age of the last fetch", () => {
    expect(fetchedAgo(null, NOW)).toBe("not loaded yet");
    expect(fetchedAgo(NOW - 20_000, NOW)).toBe("updated just now");
    expect(fetchedAgo(NOW - 5 * 60_000, NOW)).toBe("updated 5 min ago");
    expect(fetchedAgo(NOW - 60 * 60_000, NOW)).toBe("updated 1 hour ago");
    expect(fetchedAgo(NOW - 3 * 60 * 60_000, NOW)).toBe("updated 3 hours ago");
    expect(fetchedAgo(NOW - 49 * 60 * 60_000, NOW)).toBe("updated 2 days ago");
  });
});

describe("friends in a backup", () => {
  const BASE = {
    sessions: [],
    climbs: [],
    schedules: [],
    notes: [],
    weights: {},
    weightsB: {},
    selectedWorkout: "repeaters" as const,
    gymDefaults: {},
    lifts: [],
    mountainProjectUrl: "",
    now: NOW,
  };

  it("keeps who they are and leaves their ticks out", () => {
    const ref = toFriendRef(FRIEND);
    expect(ref).toEqual({
      id: "111",
      name: "Ada Climber",
      tickExportUrl: FRIEND.tickExportUrl,
      addedAt: FRIEND.addedAt,
    });
    expect(friendFromRef(ref)).toEqual({ ...ref, fetchedAt: null, climbs: [] });
  });

  it("round-trips through validateBackup", () => {
    const file = JSON.parse(JSON.stringify(buildBackup({ ...BASE, friends: [toFriendRef(FRIEND)] })));
    const r = validateBackup(file);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.file.data.friends).toEqual([toFriendRef(FRIEND)]);
  });

  it("reads a backup from before friends existed as having none", () => {
    const file = JSON.parse(JSON.stringify(buildBackup(BASE)));
    delete file.data.friends;
    const r = validateBackup(file);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.file.data.friends).toEqual([]);
  });

  it("rejects a friend whose link isn't a Mountain Project user", () => {
    const file = JSON.parse(
      JSON.stringify(
        buildBackup({ ...BASE, friends: [{ ...toFriendRef(FRIEND), tickExportUrl: "https://example.com/x.csv" }] }),
      ),
    );
    const r = validateBackup(file);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/friends\[0\]/);
  });
});
