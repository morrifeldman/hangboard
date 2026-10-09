import { describe, it, expect } from "vitest";
import { climbPRs } from "../climbPRs";
import type { ClimbRecord } from "../climbs";

let n = 0;
function climb(date: string, grade: string, style: ClimbRecord["style"], overrides: Partial<ClimbRecord> = {}): ClimbRecord {
  return {
    id: `c${++n}`,
    route: `Route ${n}`,
    grade,
    location: "Crag",
    type: "sport",
    setting: "outdoor",
    style,
    climbs: 1,
    date,
    notes: "",
    ...overrides,
  };
}

describe("climbPRs", () => {
  it("doesn't count the first send of a style", () => {
    expect(climbPRs([climb("2026-03-01", "5.11a", "redpoint")]).size).toBe(0);
  });

  it("flags a send harder than every earlier one of its style, whatever the stored order", () => {
    const later = climb("2026-03-10", "5.11c", "redpoint");
    const tie = climb("2026-03-12", "5.11c", "redpoint");
    const easier = climb("2026-03-05", "5.10d", "redpoint");
    const first = climb("2026-03-01", "5.11a", "redpoint");
    const prs = climbPRs([later, tie, easier, first]);
    expect([...prs]).toEqual([later.id]);
  });

  it("tracks each style on its own", () => {
    const flash = climb("2026-03-01", "5.12a", "flash");
    const rp1 = climb("2026-03-02", "5.11a", "redpoint");
    const rp2 = climb("2026-03-03", "5.11b", "redpoint");
    const os1 = climb("2026-03-03", "5.10a", "onsight");
    const os2 = climb("2026-03-04", "5.10b", "onsight");
    expect(climbPRs([flash, rp1, rp2, os1, os2])).toEqual(new Set([rp2.id, os2.id]));
  });

  it("only flags the hardest of a style on one day", () => {
    const base = climb("2026-03-01", "5.10a", "onsight");
    const a = climb("2026-03-02", "5.10c", "onsight");
    const b = climb("2026-03-02", "5.11a", "onsight");
    expect(climbPRs([base, a, b])).toEqual(new Set([b.id]));
  });

  it("ignores attempts and keeps sport and boulder apart", () => {
    const sport = climb("2026-03-01", "5.11a", "redpoint");
    const attempt = climb("2026-03-02", "5.13a", "attempt");
    const boulder = climb("2026-03-03", "V5", "redpoint", { type: "boulder" });
    const sport2 = climb("2026-03-04", "5.11b", "redpoint");
    expect(climbPRs([sport, attempt, boulder, sport2])).toEqual(new Set([sport2.id]));
  });
});
