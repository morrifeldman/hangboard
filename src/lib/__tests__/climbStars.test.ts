import { describe, it, expect } from "vitest";
import { routeStars, type ClimbRecord } from "../climbs";

const tick = (extra: Partial<ClimbRecord>): ClimbRecord => ({
  id: "x", route: "R", grade: "5.10a", location: "", type: "sport", setting: "outdoor",
  style: "redpoint", climbs: 1, date: "2024-01-01", notes: "", ...extra,
});

describe("routeStars", () => {
  it("takes the first valid rating of each kind", () => {
    expect(routeStars([tick({}), tick({ stars: 3 }), tick({ avgStars: 2.7, stars: 1 })])).toEqual({ stars: 3, avgStars: 2.7 });
  });
  it("ignores out-of-range values from a bad backup", () => {
    expect(routeStars([tick({ stars: 9, avgStars: NaN })])).toEqual({ stars: undefined, avgStars: undefined });
  });
});
