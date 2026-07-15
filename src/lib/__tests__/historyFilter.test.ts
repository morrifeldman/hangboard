import { describe, it, expect } from "vitest";
import {
  workoutLabel,
  workoutTypeLabel,
  workoutTypeCounts,
  workoutTypeGroups,
  normalizeQuery,
  sessionMatchesQuery,
  climbMatchesQuery,
  noteMatchesQuery,
} from "../historyFilter";
import type { SessionRecord, SessionHoldRecord, GymData } from "../history";
import type { ClimbRecord } from "../climbs";
import type { NoteRecord } from "../notes";

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeHold(overrides: Partial<SessionHoldRecord> = {}): SessionHoldRecord {
  return {
    holdId: "jug",
    holdName: "Jug",
    set1: { weight: 10, reps: 7, completed: true },
    set2: { weight: 5, reps: 6, completed: true },
    ...overrides,
  };
}

function makeSession(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: "s1",
    workoutType: "repeaters",
    startedAt: 1000,
    completedAt: 2000,
    bailed: false,
    holds: [makeHold()],
    ...overrides,
  };
}

function makeGymSession(gymData: GymData, overrides: Partial<SessionRecord> = {}): SessionRecord {
  return makeSession({
    id: "g1",
    workoutType: gymData.type,
    holds: [],
    gymData,
    ...overrides,
  });
}

function makeClimb(overrides: Partial<ClimbRecord> = {}): ClimbRecord {
  return {
    id: "c1",
    route: "Breakfast Burrito",
    grade: "5.10d",
    location: "Drive-By Crag",
    type: "sport",
    setting: "outdoor",
    style: "redpoint",
    climbs: 2,
    date: "2026-07-01",
    notes: "pumpy finish",
    ...overrides,
  };
}

function makeNote(overrides: Partial<NoteRecord> = {}): NoteRecord {
  return {
    id: "n1",
    date: "2026-07-01",
    text: "Shoulder felt tweaky",
    category: "Injury",
    createdAt: 1000,
    ...overrides,
  };
}

// ─── Labels ──────────────────────────────────────────────────────────────────

describe("workoutTypeLabel / workoutLabel", () => {
  it("maps hangboard types", () => {
    expect(workoutTypeLabel("repeaters")).toBe("Repeaters");
    expect(workoutTypeLabel("max-hang")).toBe("Max Hang");
    expect(workoutTypeLabel("beginner")).toBe("Beginner");
  });

  it("maps gym types", () => {
    expect(workoutTypeLabel("arc")).toBe("ARC");
    expect(workoutTypeLabel("stretching")).toBe("Stretching");
    expect(workoutTypeLabel("campus")).toBe("Campus");
  });

  it("falls back to the raw type for unknown values", () => {
    expect(workoutTypeLabel("mystery")).toBe("mystery");
  });

  it("workoutLabel reads the record's workoutType", () => {
    expect(workoutLabel(makeSession({ workoutType: "max-hang" }))).toBe("Max Hang");
  });
});

// ─── Counts and groups ───────────────────────────────────────────────────────

describe("workoutTypeCounts", () => {
  it("counts sessions per type", () => {
    const counts = workoutTypeCounts([
      makeSession(),
      makeSession({ id: "s2" }),
      makeSession({ id: "s3", workoutType: "arc" }),
    ]);
    expect(counts.get("repeaters")).toBe(2);
    expect(counts.get("arc")).toBe(1);
    expect(counts.has("max-hang")).toBe(false);
  });
});

describe("workoutTypeGroups", () => {
  it("splits hangboard (fixed order) from gym (most-used first)", () => {
    const sessions = [
      makeSession({ id: "1", workoutType: "max-hang" }),
      makeSession({ id: "2", workoutType: "repeaters" }),
      makeSession({ id: "3", workoutType: "stretching" }),
      makeSession({ id: "4", workoutType: "stretching" }),
      makeSession({ id: "5", workoutType: "arc" }),
    ];
    const groups = workoutTypeGroups(sessions);
    expect(groups.hangboard).toEqual(["repeaters", "max-hang"]);
    expect(groups.gym).toEqual(["stretching", "arc"]);
  });

  it("returns empty groups for no sessions", () => {
    expect(workoutTypeGroups([])).toEqual({ hangboard: [], gym: [] });
  });
});

// ─── normalizeQuery ──────────────────────────────────────────────────────────

describe("normalizeQuery", () => {
  it("trims and lowercases", () => {
    expect(normalizeQuery("  Max Hang ")).toBe("max hang");
    expect(normalizeQuery("   ")).toBe("");
  });
});

// ─── sessionMatchesQuery ─────────────────────────────────────────────────────

describe("sessionMatchesQuery", () => {
  it("empty query matches everything", () => {
    expect(sessionMatchesQuery(makeSession(), "")).toBe(true);
  });

  it("matches the workout label case-insensitively", () => {
    expect(sessionMatchesQuery(makeSession({ workoutType: "max-hang" }), "max h")).toBe(true);
    expect(sessionMatchesQuery(makeSession(), "max h")).toBe(false);
  });

  it("matches session notes", () => {
    expect(sessionMatchesQuery(makeSession({ notes: "Felt strong today" }), "strong")).toBe(true);
  });

  it("matches hold names and hold/set notes", () => {
    expect(sessionMatchesQuery(makeSession(), "jug")).toBe(true);
    const withHoldNote = makeSession({ holds: [makeHold({ notes: "skin split" })] });
    expect(sessionMatchesQuery(withHoldNote, "skin")).toBe(true);
    const withSetNote = makeSession({
      holds: [makeHold({ set2: { weight: 5, reps: 6, completed: false, notes: "bailed early" } })],
    });
    expect(sessionMatchesQuery(withSetNote, "bailed early")).toBe(true);
  });

  it("matches gym data strings (stretches, cardio mode, freeform entries)", () => {
    const stretching = makeGymSession({ type: "stretching", stretches: ["Hamstrings", "Quads"], reps: 3 });
    expect(sessionMatchesQuery(stretching, "hamstring")).toBe(true);
    expect(sessionMatchesQuery(stretching, "biceps")).toBe(false);

    const cardio = makeGymSession({ type: "cardio", mode: "Rowing", durationMin: 20 });
    expect(sessionMatchesQuery(cardio, "rowing")).toBe(true);

    const freeform = makeGymSession({
      type: "freeform",
      title: "Antagonist day",
      sections: [{ name: "Push", entries: [{ key: "Dips", value: "3x10" }] }],
    });
    expect(sessionMatchesQuery(freeform, "antagonist")).toBe(true);
    expect(sessionMatchesQuery(freeform, "dips")).toBe(true);
  });

  it("does not match numeric gym values as text", () => {
    const cardio = makeGymSession({ type: "cardio", mode: "Rowing", durationMin: 20 });
    expect(sessionMatchesQuery(cardio, "20")).toBe(false);
  });
});

// ─── climbMatchesQuery ───────────────────────────────────────────────────────

describe("climbMatchesQuery", () => {
  it("empty query matches", () => {
    expect(climbMatchesQuery(makeClimb(), "")).toBe(true);
  });

  it("matches route, grade, location, notes", () => {
    expect(climbMatchesQuery(makeClimb(), "burrito")).toBe(true);
    expect(climbMatchesQuery(makeClimb(), "5.10")).toBe(true);
    expect(climbMatchesQuery(makeClimb(), "drive-by")).toBe(true);
    expect(climbMatchesQuery(makeClimb(), "pumpy")).toBe(true);
  });

  it("matches style / type / setting keywords", () => {
    expect(climbMatchesQuery(makeClimb(), "redpoint")).toBe(true);
    expect(climbMatchesQuery(makeClimb(), "outdoor")).toBe(true);
    expect(climbMatchesQuery(makeClimb(), "sport")).toBe(true);
  });

  it("rejects non-matches", () => {
    expect(climbMatchesQuery(makeClimb(), "onsight")).toBe(false);
  });
});

// ─── noteMatchesQuery ────────────────────────────────────────────────────────

describe("noteMatchesQuery", () => {
  it("matches text and category", () => {
    expect(noteMatchesQuery(makeNote(), "tweaky")).toBe(true);
    expect(noteMatchesQuery(makeNote(), "injury")).toBe(true);
    expect(noteMatchesQuery(makeNote(), "finger")).toBe(false);
  });

  it("handles missing category", () => {
    expect(noteMatchesQuery(makeNote({ category: undefined }), "tweaky")).toBe(true);
    expect(noteMatchesQuery(makeNote({ category: undefined }), "injury")).toBe(false);
  });
});
