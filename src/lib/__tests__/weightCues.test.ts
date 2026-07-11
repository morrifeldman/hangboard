import { describe, it, expect } from "vitest";
import { holdNextDirection, sessionNextSummary, overviewDelta } from "../weightCues";
import type { SessionRecord, SessionHoldRecord, SessionNextTarget } from "../history";

function makeHold(
  weights: { set1: number; set2?: number | null; set3?: number | null },
  next?: SessionNextTarget,
  id = "jug",
): SessionHoldRecord {
  return {
    holdId: id,
    holdName: id,
    set1: { weight: weights.set1, reps: 7, completed: true },
    set2:
      weights.set2 === null || weights.set2 === undefined
        ? null
        : { weight: weights.set2, reps: 6, completed: true },
    ...(weights.set3 !== undefined && weights.set3 !== null
      ? { set3: { weight: weights.set3, reps: 1, completed: true } }
      : {}),
    ...(next ? { next } : {}),
  };
}

function makeSession(holds: SessionHoldRecord[]): SessionRecord {
  return {
    id: "s-1",
    workoutType: "repeaters",
    startedAt: 0,
    completedAt: 1000,
    bailed: false,
    holds,
  };
}

describe("holdNextDirection", () => {
  it("returns null when the hold has no next target", () => {
    expect(holdNextDirection(makeHold({ set1: 10, set2: 5 }))).toBeNull();
  });

  it("returns null when nothing changed", () => {
    expect(
      holdNextDirection(makeHold({ set1: 10, set2: 5 }, { set1: 10, set2: 5 })),
    ).toBeNull();
  });

  it("detects an increase on either set", () => {
    expect(
      holdNextDirection(makeHold({ set1: 10, set2: 5 }, { set1: 12.5, set2: 5 })),
    ).toBe("up");
    expect(
      holdNextDirection(makeHold({ set1: 10, set2: 5 }, { set1: 10, set2: 7.5 })),
    ).toBe("up");
  });

  it("detects a decrease", () => {
    expect(
      holdNextDirection(makeHold({ set1: 10, set2: 5 }, { set1: 5, set2: 0 })),
    ).toBe("down");
  });

  it("returns mixed when sets move in opposite directions", () => {
    expect(
      holdNextDirection(makeHold({ set1: 10, set2: 5 }, { set1: 12.5, set2: 2.5 })),
    ).toBe("mixed");
  });

  it("handles single-set holds (set2 null in record and target)", () => {
    expect(holdNextDirection(makeHold({ set1: 10, set2: null }, { set1: 15, set2: null }))).toBe(
      "up",
    );
  });

  it("compares set3 for max-hang holds", () => {
    expect(
      holdNextDirection(
        makeHold({ set1: 40, set2: 45, set3: 50 }, { set1: 40, set2: 45, set3: 55 }),
      ),
    ).toBe("up");
  });
});

describe("sessionNextSummary", () => {
  it("returns null when no hold carries a next target (imported/legacy)", () => {
    expect(sessionNextSummary(makeSession([makeHold({ set1: 10, set2: 5 })]))).toBeNull();
  });

  it("counts holds going up and down; unchanged holds count toward neither", () => {
    const s = makeSession([
      makeHold({ set1: 10, set2: 5 }, { set1: 12.5, set2: 7.5 }, "a"),
      makeHold({ set1: 10, set2: 5 }, { set1: 5, set2: 0 }, "b"),
      makeHold({ set1: 10, set2: 5 }, { set1: 10, set2: 5 }, "c"),
    ]);
    expect(sessionNextSummary(s)).toEqual({ up: 1, down: 1 });
  });

  it("counts a mixed hold toward both directions", () => {
    const s = makeSession([
      makeHold({ set1: 10, set2: 5 }, { set1: 12.5, set2: 2.5 }, "a"),
    ]);
    expect(sessionNextSummary(s)).toEqual({ up: 1, down: 1 });
  });

  it("returns zero counts (not null) when targets exist but nothing changed", () => {
    const s = makeSession([makeHold({ set1: 10, set2: 5 }, { set1: 10, set2: 5 })]);
    expect(sessionNextSummary(s)).toEqual({ up: 0, down: 0 });
  });
});

describe("overviewDelta", () => {
  it("returns null with no baseline hold", () => {
    expect(overviewDelta(10, undefined, 1)).toBeNull();
  });

  it("returns null for set 2 when the baseline hold had no set 2", () => {
    expect(overviewDelta(10, makeHold({ set1: 10, set2: null }), 2)).toBeNull();
  });

  it("computes the delta against the recorded set weight", () => {
    const last = makeHold({ set1: 10, set2: 5 });
    expect(overviewDelta(12.5, last, 1)).toBe(2.5);
    expect(overviewDelta(2.5, last, 2)).toBe(-2.5);
    expect(overviewDelta(10, last, 1)).toBe(0);
  });
});
