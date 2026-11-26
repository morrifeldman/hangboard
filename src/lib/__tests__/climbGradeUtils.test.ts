import { describe, it, expect } from "vitest";
import { frenchGrade, normalizeGrade } from "../climbGradeUtils";
import { SPORT_GRADES } from "../../constants/climbGrades";

describe("normalizeGrade", () => {
  it("returns null for null/undefined/empty", () => {
    expect(normalizeGrade(null)).toBeNull();
    expect(normalizeGrade(undefined)).toBeNull();
    expect(normalizeGrade("")).toBeNull();
  });

  it("passes through already-normalized grades", () => {
    expect(normalizeGrade("5.12a")).toBe("5.12a");
    expect(normalizeGrade("V7")).toBe("V7");
  });

  it("handles slash grades: takes higher letter grade", () => {
    expect(normalizeGrade("5.12a/b")).toBe("5.12b");
    expect(normalizeGrade("5.10c/d")).toBe("5.10d");
  });

  it("handles slash grades: full grade on right side", () => {
    expect(normalizeGrade("5.11a/5.11b")).toBe("5.11b");
  });

  it("handles plus modifier: 5.10+ → 5.10d", () => {
    expect(normalizeGrade("5.10+")).toBe("5.10d");
    expect(normalizeGrade("5.11+")).toBe("5.11d");
  });

  it("handles minus modifier: 5.11- → 5.11a", () => {
    expect(normalizeGrade("5.11-")).toBe("5.11a");
    expect(normalizeGrade("5.12-")).toBe("5.12a");
  });

  it("preserves V-grades unchanged", () => {
    expect(normalizeGrade("V5")).toBe("V5");
    expect(normalizeGrade("V12")).toBe("V12");
  });

  it.each([
    ["5.10a", "5.10a"],
    ["5.12a/b", "5.12b"],
    ["5.10d/11a", "5.11a"],
    ["5.10+", "5.10d"],
    ["5.10-", "5.10a"],
    ["5.10", "5.10b"],
    ["5.13", "5.13b"],
    ["5.9+", "5.9"],
    ["5.9", "5.9"],
    ["5.8-", "5.8"],
    ["5.10a PG13", "5.10a"],
    ["5.10b R", "5.10b"],
    ["5.11a X", "5.11a"],
    ["5.10 b", "5.10b"],
    ["5.7 A0", "5.7"],
    ["5.10a C1", "5.10a"],
    ["5.9 A1 R", "5.9"],
    ["5.8 PG13 A2+", "5.8"],
    ["5.8 WI3", "5.8"],
    ["5.9 M5", "5.9"],
    ["5.6 Mod. Snow", "5.6"],
    ["5.4 Easy Snow", "5.4"],
    ["V3", "V3"],
    ["V3/4", "V4"],
    ["V3-4", "V4"],
    ["V3+", "V3"],
    ["V-easy", "VB"],
    ["VB", "VB"],
    ["V5 PG13", "V5"],
    ["  junk grade ", "junk grade"],
    ["WI4", "WI4"],
  ])("normalizes %s → %s", (input, expected) => {
    expect(normalizeGrade(input)).toBe(expected);
  });
});

describe("frenchGrade", () => {
  it("converts every rung of the YDS ladder", () => {
    for (const g of SPORT_GRADES) expect(frenchGrade(g)).toBeTruthy();
  });

  it("uses the standard chart", () => {
    expect(frenchGrade("5.10a")).toBe("6a");
    expect(frenchGrade("5.11d")).toBe("7a");
    expect(frenchGrade("5.12a")).toBe("7a+");
    expect(frenchGrade("5.13b")).toBe("8a");
    expect(frenchGrade("5.14d")).toBe("9a");
  });

  it("shows both sides where a YDS grade straddles two French grades", () => {
    expect(frenchGrade("5.11b")).toBe("6c/6c+");
    expect(frenchGrade("5.7")).toBe("4c/5a");
  });

  it("returns null for boulder and unrecognised grades", () => {
    expect(frenchGrade("V5")).toBeNull();
    expect(frenchGrade("6a")).toBeNull();
  });
});
