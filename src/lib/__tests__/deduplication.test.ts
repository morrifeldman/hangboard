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
    expect(result[0].date).toBe("2024-03-20"); // most recent
  });

  it("preserves attempt count for single redpoint", () => {
    const climbs = [makeClimb({ style: "redpoint", climbs: 2 })];
    const result = deduplicateForPyramid(climbs);
    expect(result[0].climbs).toBe(2);
  });

  it("uses best style (onsight > flash > redpoint > attempt)", () => {
    const climbs = [
      makeClimb({ style: "redpoint", date: "2024-01-01" }),
      makeClimb({ style: "flash", date: "2024-01-02" }),
    ];
    const result = deduplicateForPyramid(climbs);
    expect(result[0].style).toBe("flash");
  });
});
