import { describe, it, expect } from "vitest";
import { buildGradeTrend, enumerateBuckets, gradeLabel } from "../gradeTrends";
import type { ClimbRecord } from "../climbs";

function climb(overrides: Partial<ClimbRecord>): ClimbRecord {
  return {
    id: "x", route: "Route", grade: "5.11a", location: "RRG",
    type: "sport", setting: "outdoor", style: "redpoint",
    climbs: 1, date: "2025-04-15", notes: "",
    ...overrides,
  };
}

describe("enumerateBuckets", () => {
  it("emits months inclusive across year boundaries", () => {
    expect(enumerateBuckets("2025-10-20", "2026-02-05", "months"))
      .toEqual(["2025-10", "2025-11", "2025-12", "2026-01", "2026-02"]);
  });

  it("emits years inclusive", () => {
    expect(enumerateBuckets("2023-06-01", "2025-03-01", "years"))
      .toEqual(["2023", "2024", "2025"]);
  });

  it("emits seasons inclusive in winter→spring→summer→fall order", () => {
    // Jan 2025 = winter-2024, Apr 2025 = spring-2025, Aug 2025 = summer-2025
    expect(enumerateBuckets("2025-01-15", "2025-08-15", "seasons"))
      .toEqual(["winter-2024", "spring-2025", "summer-2025"]);
  });

  it("season Dec rolls into winter of that year", () => {
    // Dec 2024 = winter-2024, Mar 2025 = spring-2025
    expect(enumerateBuckets("2024-12-15", "2025-03-15", "seasons"))
      .toEqual(["winter-2024", "spring-2025"]);
  });
});

describe("buildGradeTrend", () => {
  it("filters to outdoor sport only", () => {
    const climbs: ClimbRecord[] = [
      climb({ date: "2025-04-15", grade: "5.11a", style: "redpoint" }),
      climb({ date: "2025-04-15", grade: "V5", type: "boulder", style: "redpoint" }),
      climb({ date: "2025-04-15", grade: "5.10a", setting: "indoor", style: "onsight" }),
    ];
    const points = buildGradeTrend(climbs, "months");
    expect(points).toHaveLength(1);
    expect(gradeLabel(points[0].redpoint!)).toBe("5.11a");
    expect(points[0].onsight).toBeNull();
    expect(points[0].flash).toBeNull();
  });

  it("computes per-style max grade per bucket", () => {
    const climbs: ClimbRecord[] = [
      climb({ date: "2025-04-01", grade: "5.10c", style: "onsight" }),
      climb({ date: "2025-04-15", grade: "5.11a", style: "onsight" }),
      climb({ date: "2025-04-20", grade: "5.10a", style: "onsight" }),
      climb({ date: "2025-04-10", grade: "5.12a", style: "redpoint" }),
      climb({ date: "2025-04-12", grade: "5.11b", style: "redpoint" }),
      climb({ date: "2025-04-08", grade: "5.10d", style: "flash" }),
    ];
    const [p] = buildGradeTrend(climbs, "months");
    expect(gradeLabel(p.onsight!)).toBe("5.11a");
    expect(gradeLabel(p.flash!)).toBe("5.10d");
    expect(gradeLabel(p.redpoint!)).toBe("5.12a");
  });

  it("excludes attempts from max calculation", () => {
    const climbs: ClimbRecord[] = [
      climb({ date: "2025-04-15", grade: "5.13a", style: "attempt" }),
      climb({ date: "2025-04-15", grade: "5.11a", style: "redpoint" }),
    ];
    const [p] = buildGradeTrend(climbs, "months");
    expect(gradeLabel(p.redpoint!)).toBe("5.11a");
  });

  it("fills empty buckets between climbs with null values", () => {
    const climbs: ClimbRecord[] = [
      climb({ date: "2025-01-10", grade: "5.10b", style: "onsight" }),
      climb({ date: "2025-04-10", grade: "5.11a", style: "onsight" }),
    ];
    const points = buildGradeTrend(climbs, "months");
    expect(points.map((p) => p.key)).toEqual([
      "2025-01", "2025-02", "2025-03", "2025-04",
    ]);
    expect(points[0].onsight).not.toBeNull();
    expect(points[1].onsight).toBeNull();
    expect(points[2].onsight).toBeNull();
    expect(points[3].onsight).not.toBeNull();
  });

  it("aggregates by season correctly", () => {
    const climbs: ClimbRecord[] = [
      climb({ date: "2025-04-15", grade: "5.11a", style: "redpoint" }), // spring-2025
      climb({ date: "2025-05-20", grade: "5.11d", style: "redpoint" }), // spring-2025
      climb({ date: "2025-10-10", grade: "5.12a", style: "redpoint" }), // fall-2025
    ];
    const points = buildGradeTrend(climbs, "seasons");
    expect(points.map((p) => p.key)).toEqual([
      "spring-2025", "summer-2025", "fall-2025",
    ]);
    expect(gradeLabel(points[0].redpoint!)).toBe("5.11d");
    expect(points[1].redpoint).toBeNull();
    expect(gradeLabel(points[2].redpoint!)).toBe("5.12a");
  });

  it("returns empty array when no outdoor sport climbs", () => {
    expect(buildGradeTrend([], "months")).toEqual([]);
    expect(buildGradeTrend([climb({ setting: "indoor" })], "months")).toEqual([]);
  });

  it("ignores grades outside the SPORT_GRADES scale", () => {
    const climbs: ClimbRecord[] = [
      climb({ date: "2025-04-15", grade: "5.13d", style: "redpoint" }), // top of scale
      climb({ date: "2025-04-15", grade: "5.9", style: "redpoint" }),   // not in scale
    ];
    const [p] = buildGradeTrend(climbs, "months");
    expect(gradeLabel(p.redpoint!)).toBe("5.13d");
  });
});
