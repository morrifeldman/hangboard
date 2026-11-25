import { describe, it, expect } from "vitest";
import { parseMountainProjectCSV, routeDiscipline } from "../mountainProjectImport";
import { climbsInView, getFilteredClimbs } from "../climbUtils";
import { buildGradeTrend } from "../gradeTrends";
import type { ClimbRecord } from "../climbs";

function climb(overrides: Partial<ClimbRecord>): ClimbRecord {
  return {
    id: "x", route: "Route", grade: "5.11a", location: "RRG",
    type: "sport", setting: "outdoor", style: "redpoint",
    climbs: 1, date: "2025-04-15", notes: "",
    ...overrides,
  };
}

describe("routeDiscipline", () => {
  it("reads trad and sport routes", () => {
    expect(routeDiscipline("Trad")).toBe("trad");
    expect(routeDiscipline("Sport")).toBe("sport");
    expect(routeDiscipline("Trad, Aid")).toBe("trad");
    expect(routeDiscipline("Trad, TR")).toBe("trad");
  });

  it("counts mixed and top-rope-only routes as sport", () => {
    expect(routeDiscipline("TR")).toBe("sport");
    expect(routeDiscipline("Trad, Sport")).toBe("sport");
    expect(routeDiscipline("Sport, TR")).toBe("sport");
  });

  it("reads anything else as sport, as before", () => {
    expect(routeDiscipline(undefined)).toBe("sport");
    expect(routeDiscipline("")).toBe("sport");
    expect(routeDiscipline("Aid")).toBe("sport");
  });

  it("is stored on imported routes, not boulders", () => {
    const csv =
      "Date,Route,Rating,Notes,Pitches,Location,Route Type,Lead Style\n" +
      "2024-01-01,Crack,5.10a,,1,Indian Creek,Trad,Onsight\n" +
      '2024-01-01,Bolts,5.11a,,1,RRG,"Trad, Sport",Redpoint\n' +
      "2024-01-01,Rock,V4,,1,Bishop,Boulder,Flash\n";
    const [crack, bolts, rock] = parseMountainProjectCSV(csv);
    expect(crack.discipline).toBe("trad");
    expect(bolts.discipline).toBe("sport");
    expect(rock.discipline).toBeUndefined();
    expect(crack.type).toBe("sport");
  });
});

describe("climbsInView with a discipline", () => {
  const climbs = [
    climb({ id: "old" }), // imported before discipline: sport
    climb({ id: "sport", discipline: "sport" }),
    climb({ id: "trad", discipline: "trad" }),
    climb({ id: "indoor", setting: "indoor" }),
  ];
  const ids = (cs: ClimbRecord[]) => cs.map((c) => c.id);

  it("shows every outdoor route for all", () => {
    expect(ids(climbsInView(climbs, "outdoor-sport"))).toEqual(["old", "sport", "trad"]);
  });

  it("narrows to sport (including records without a discipline) or trad", () => {
    expect(ids(climbsInView(climbs, "outdoor-sport", "sport"))).toEqual(["old", "sport"]);
    expect(ids(climbsInView(climbs, "outdoor-sport", "trad"))).toEqual(["trad"]);
  });

  it("spans the time range over the narrowed climbs", () => {
    const spread = [
      climb({ id: "a", date: "2020-01-01" }),
      climb({ id: "b", date: "2024-01-01", discipline: "trad" }),
      climb({ id: "c", date: "2025-01-01", discipline: "trad" }),
    ];
    // The first half of the trad span is 2024 only.
    expect(ids(getFilteredClimbs(spread, "outdoor-sport", [0, 40], "trad"))).toEqual(["b"]);
  });
});

describe("buildGradeTrend", () => {
  it("includes trad routes", () => {
    const trend = buildGradeTrend(
      [climb({ id: "t", grade: "5.11a", discipline: "trad", date: "2025-04-01" })],
      "years",
    );
    expect(trend).toHaveLength(1);
    expect(trend[0].redpoint).not.toBeNull();
  });
});
