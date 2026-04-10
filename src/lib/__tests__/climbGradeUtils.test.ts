import { describe, it, expect } from "vitest";
import { normalizeGrade } from "../climbGradeUtils";

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
});
