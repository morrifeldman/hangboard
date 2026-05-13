import { describe, it, expect } from "vitest";
import {
  generateWindows,
  filterClimbsByWindow,
  isInWindow,
} from "../pyramidData";
import type { SeasonWindow } from "../pyramidData";
import type { ClimbRecord } from "../climbs";

function makeClimb(date: string, overrides: Partial<ClimbRecord> = {}): ClimbRecord {
  return {
    id: `${date}-${Math.random()}`,
    route: "Test Route",
    grade: "5.11a",
    location: "Red River Gorge",
    type: "sport",
    setting: "outdoor",
    style: "redpoint",
    climbs: 1,
    date,
    notes: "",
    ...overrides,
  };
}

describe("generateWindows", () => {
  it("returns empty for empty input", () => {
    expect(generateWindows([], "seasons")).toEqual([]);
    expect(generateWindows([], "years")).toEqual([]);
    expect(generateWindows([], "halves-fw-ss")).toEqual([]);
    expect(generateWindows([], "halves-ws-sf")).toEqual([]);
  });

  describe("years", () => {
    it("emits one window per calendar year, newest first", () => {
      const result = generateWindows(
        [makeClimb("2024-03-01"), makeClimb("2025-07-01"), makeClimb("2026-02-01")],
        "years",
      );
      expect(result.map((w) => w.id)).toEqual(["year-2026", "year-2025", "year-2024"]);
    });

    it("uses Jan 1 – Dec 31 as the range", () => {
      const result = generateWindows([makeClimb("2025-07-01")], "years");
      expect(result[0].ranges).toEqual([{ start: "2025-01-01", end: "2025-12-31" }]);
    });
  });

  describe("seasons", () => {
    it("buckets Mar–May into Spring", () => {
      const w = generateWindows([makeClimb("2025-04-10")], "seasons")[0];
      expect(w.id).toBe("spring-2025");
      expect(w.label).toBe("Spring 2025");
      expect(w.ranges).toEqual([{ start: "2025-03-01", end: "2025-05-31" }]);
    });

    it("buckets Jun–Aug into Summer", () => {
      const w = generateWindows([makeClimb("2025-07-10")], "seasons")[0];
      expect(w.id).toBe("summer-2025");
    });

    it("buckets Sep–Nov into Fall", () => {
      const w = generateWindows([makeClimb("2025-10-10")], "seasons")[0];
      expect(w.id).toBe("fall-2025");
    });

    it("buckets Dec into Winter of that year", () => {
      const w = generateWindows([makeClimb("2025-12-15")], "seasons")[0];
      expect(w.id).toBe("winter-2025");
      expect(w.label).toBe("Winter 25–26");
      expect(w.ranges).toEqual([{ start: "2025-12-01", end: "2026-02-28" }]);
    });

    it("buckets Jan–Feb into Winter of the previous year", () => {
      const w = generateWindows([makeClimb("2026-01-15")], "seasons")[0];
      expect(w.id).toBe("winter-2025");
    });

    it("uses Feb 29 as winter end in leap years", () => {
      const w = generateWindows([makeClimb("2027-12-01")], "seasons")[0];
      // 2028 is a leap year — winter ends Feb 29 2028
      expect(w.ranges[0].end).toBe("2028-02-29");
    });

    it("orders all four seasons newest first by start date", () => {
      const result = generateWindows(
        [
          makeClimb("2025-04-10"), // Spring 2025
          makeClimb("2025-07-10"), // Summer 2025
          makeClimb("2025-10-10"), // Fall 2025
          makeClimb("2025-12-15"), // Winter 25–26
          makeClimb("2026-04-10"), // Spring 2026
        ],
        "seasons",
      );
      expect(result.map((w) => w.id)).toEqual([
        "spring-2026",
        "winter-2025",
        "fall-2025",
        "summer-2025",
        "spring-2025",
      ]);
    });
  });

  describe("halves-fw-ss", () => {
    it("buckets Sep–Dec into Fall+Winter of that year", () => {
      const w = generateWindows([makeClimb("2025-10-15")], "halves-fw-ss")[0];
      expect(w.id).toBe("fw-2025");
      expect(w.label).toBe("Fall+Winter 25–26");
      expect(w.ranges).toEqual([{ start: "2025-09-01", end: "2026-02-28" }]);
    });

    it("buckets Jan–Feb into Fall+Winter of the previous year", () => {
      const w = generateWindows([makeClimb("2026-02-10")], "halves-fw-ss")[0];
      expect(w.id).toBe("fw-2025");
    });

    it("buckets Mar–Aug into Spring+Summer of that year", () => {
      const w = generateWindows([makeClimb("2025-05-15")], "halves-fw-ss")[0];
      expect(w.id).toBe("ss-2025");
      expect(w.label).toBe("Spring+Summer 2025");
      expect(w.ranges).toEqual([{ start: "2025-03-01", end: "2025-08-31" }]);
    });

    it("groups fall + early-next-year into a single window", () => {
      const result = generateWindows(
        [makeClimb("2025-10-15"), makeClimb("2026-01-20")],
        "halves-fw-ss",
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("fw-2025");
    });
  });

  describe("halves-ws-sf", () => {
    it("buckets Dec into Winter+Spring of that year", () => {
      const w = generateWindows([makeClimb("2025-12-15")], "halves-ws-sf")[0];
      expect(w.id).toBe("ws-2025");
      expect(w.label).toBe("Winter+Spring 25–26");
      expect(w.ranges).toEqual([{ start: "2025-12-01", end: "2026-05-31" }]);
    });

    it("buckets Jan–May into Winter+Spring of the previous year", () => {
      const w = generateWindows([makeClimb("2026-04-15")], "halves-ws-sf")[0];
      expect(w.id).toBe("ws-2025");
    });

    it("buckets Jun–Nov into Summer+Fall of that year", () => {
      const w = generateWindows([makeClimb("2025-08-10")], "halves-ws-sf")[0];
      expect(w.id).toBe("sf-2025");
      expect(w.label).toBe("Summer+Fall 2025");
      expect(w.ranges).toEqual([{ start: "2025-06-01", end: "2025-11-30" }]);
    });
  });
});

describe("isInWindow", () => {
  const w: SeasonWindow = {
    id: "fw-2025",
    label: "Fall+Winter 25–26",
    kind: "halves-fw-ss",
    ranges: [{ start: "2025-09-01", end: "2026-02-28" }],
  };

  it("returns true for dates inside the (year-spanning) range", () => {
    expect(isInWindow("2025-10-15", w)).toBe(true);
    expect(isInWindow("2025-12-31", w)).toBe(true);
    expect(isInWindow("2026-01-20", w)).toBe(true);
    expect(isInWindow("2025-09-01", w)).toBe(true);
    expect(isInWindow("2026-02-28", w)).toBe(true);
  });

  it("returns false for dates outside the range", () => {
    expect(isInWindow("2025-08-31", w)).toBe(false);
    expect(isInWindow("2026-03-01", w)).toBe(false);
  });
});

describe("filterClimbsByWindow", () => {
  const w: SeasonWindow = {
    id: "fw-2025",
    label: "Fall+Winter 25–26",
    kind: "halves-fw-ss",
    ranges: [{ start: "2025-09-01", end: "2026-02-28" }],
  };

  it("keeps only climbs in the window", () => {
    const climbs = [
      makeClimb("2025-10-15", { route: "in" }),
      makeClimb("2026-01-20", { route: "in" }),
      makeClimb("2025-08-31", { route: "out" }),
      makeClimb("2026-03-01", { route: "out" }),
    ];
    const result = filterClimbsByWindow(climbs, w);
    expect(result.map((c) => c.route)).toEqual(["in", "in"]);
  });
});
