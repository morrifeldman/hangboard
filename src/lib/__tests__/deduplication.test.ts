import { describe, it, expect } from "vitest";
import { deduplicateForTimeline, deduplicateForPyramid } from "../deduplication";
import type { ClimbRecord } from "../climbs";

function makeClimb(overrides: Partial<ClimbRecord> = {}): ClimbRecord {
  return {
    id: crypto.randomUUID(),
    route: "Test Route",
    grade: "5.11a",
    location: "Test Crag",
    type: "sport",
    setting: "outdoor",
    style: "attempt",
    climbs: 1,
    date: "2024-03-15",
    notes: "",
    ...overrides,
  };
}

describe("deduplicateForTimeline", () => {
  it("merges same route on same date", () => {
    const climbs = [
      makeClimb({ style: "attempt", climbs: 1, notes: "try 1" }),
      makeClimb({ style: "redpoint", climbs: 1, notes: "sent!" }),
    ];
    const result = deduplicateForTimeline(climbs);
    expect(result).toHaveLength(1);
    expect(result[0].climbs).toBe(2);
    expect(result[0].style).toBe("redpoint");
    expect(result[0].notes).toContain("try 1");
    expect(result[0].notes).toContain("sent!");
  });

  it("keeps different dates separate", () => {
    const climbs = [
      makeClimb({ date: "2024-03-15" }),
      makeClimb({ date: "2024-03-16" }),
    ];
    const result = deduplicateForTimeline(climbs);
    expect(result).toHaveLength(2);
  });

  it("keeps different routes separate on same date", () => {
    const climbs = [
      makeClimb({ route: "Route A" }),
      makeClimb({ route: "Route B" }),
    ];
    const result = deduplicateForTimeline(climbs);
    expect(result).toHaveLength(2);
  });
});

describe("deduplicateForPyramid", () => {
  it("merges same route across dates", () => {
    const climbs = [
      makeClimb({ date: "2024-03-15", style: "attempt", climbs: 2 }),
      makeClimb({ date: "2024-03-20", style: "redpoint", climbs: 1 }),
    ];
    const result = deduplicateForPyramid(climbs);
    expect(result).toHaveLength(1);
    expect(result[0].climbs).toBe(3);
    expect(result[0].style).toBe("redpoint");
    expect(result[0].date).toBe("2024-03-20"); // the redpoint
    expect(result[0].sessions).toBe(2);
  });

  it("preserves attempt count for single redpoint", () => {
    const climbs = [makeClimb({ style: "redpoint", climbs: 2 })];
    const result = deduplicateForPyramid(climbs);
    expect(result[0].climbs).toBe(2);
    expect(result[0].sessions).toBe(1);
  });

  it("uses best style (onsight > flash > redpoint > attempt)", () => {
    const climbs = [
      makeClimb({ style: "redpoint", date: "2024-01-01" }),
      makeClimb({ style: "flash", date: "2024-01-02" }),
    ];
    const result = deduplicateForPyramid(climbs);
    expect(result[0].style).toBe("flash");
    expect(result[0].sessions).toBe(2);
  });

  it("counts sessions independently of climb sums on re-sends", () => {
    const climbs = [
      makeClimb({ date: "2024-03-15", style: "redpoint", climbs: 1 }),
      makeClimb({ date: "2024-04-01", style: "redpoint", climbs: 1 }),
      makeClimb({ date: "2024-05-01", style: "redpoint", climbs: 1 }),
    ];
    const result = deduplicateForPyramid(climbs);
    expect(result).toHaveLength(1);
    expect(result[0].sessions).toBe(3);
    // Re-sends don't sum into climbs
    expect(result[0].climbs).toBe(1);
  });
});

describe("deduplicateForPyramid send date", () => {
  it("dates a redpoint after failed attempts by the redpoint", () => {
    const rp = makeClimb({ date: "2024-04-02", style: "redpoint", climbs: 1 });
    const result = deduplicateForPyramid([
      makeClimb({ date: "2024-03-01", style: "attempt", climbs: 3 }),
      rp,
      makeClimb({ date: "2024-03-15", style: "attempt", climbs: 2 }),
    ]);
    expect(result[0].date).toBe("2024-04-02");
    expect(result[0].id).toBe(rp.id);
  });

  it("keeps the first send's date when the route is repeated later", () => {
    const os = makeClimb({ date: "2023-06-01", style: "onsight" });
    // Newest first, as getClimbs returns them.
    const result = deduplicateForPyramid([
      makeClimb({ date: "2025-09-01", style: "redpoint" }),
      makeClimb({ date: "2024-07-01", style: "flash" }),
      os,
    ]);
    expect(result[0].style).toBe("onsight");
    expect(result[0].date).toBe("2023-06-01");
    expect(result[0].id).toBe(os.id);
  });

  it("dates by the first redpoint among several", () => {
    const result = deduplicateForPyramid([
      makeClimb({ date: "2024-05-01", style: "redpoint" }),
      makeClimb({ date: "2024-03-15", style: "redpoint" }),
      makeClimb({ date: "2024-04-01", style: "redpoint" }),
    ]);
    expect(result[0].date).toBe("2024-03-15");
  });

  it("dates a top-roped route that was later led by the lead", () => {
    const result = deduplicateForPyramid([
      makeClimb({ date: "2024-01-10", style: "toprope" }),
      makeClimb({ date: "2024-02-20", style: "redpoint" }),
    ]);
    expect(result[0].style).toBe("redpoint");
    expect(result[0].date).toBe("2024-02-20");
  });

  it("dates a never-sent route by its first attempt", () => {
    const result = deduplicateForPyramid([
      makeClimb({ date: "2024-05-01", style: "attempt" }),
      makeClimb({ date: "2024-03-01", style: "attempt" }),
    ]);
    expect(result[0].date).toBe("2024-03-01");
  });

  it("takes the grade from the most recent session", () => {
    const result = deduplicateForPyramid([
      makeClimb({ date: "2024-01-01", style: "onsight", grade: "5.11a" }),
      makeClimb({ date: "2025-01-01", style: "redpoint", grade: "5.11b" }),
    ]);
    expect(result[0].date).toBe("2024-01-01");
    expect(result[0].grade).toBe("5.11b");
  });
});

describe("dedup keys", () => {
  it("does not collide on hyphenated route/location splits", () => {
    const a = makeClimb({ route: "A-B", location: "C" });
    const b = makeClimb({ route: "A", location: "B-C" });
    expect(deduplicateForTimeline([a, b])).toHaveLength(2);
    expect(deduplicateForPyramid([a, b])).toHaveLength(2);
  });

  it("keeps different type or setting separate", () => {
    const sport = makeClimb({ type: "sport" });
    const boulder = makeClimb({ type: "boulder" });
    const indoor = makeClimb({ setting: "indoor" });
    expect(deduplicateForTimeline([sport, boulder])).toHaveLength(2);
    expect(deduplicateForPyramid([sport, boulder])).toHaveLength(2);
    expect(deduplicateForTimeline([sport, indoor])).toHaveLength(2);
    expect(deduplicateForPyramid([sport, indoor])).toHaveLength(2);
  });
});
