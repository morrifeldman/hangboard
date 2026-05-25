import { describe, it, expect } from "vitest";
import {
  sequenceShortLabel,
  shortCodeToSequence,
  ladderDisplayName,
  rungShortLabel,
  CAMPUS_TEMPLATE,
} from "../../data/gymWorkouts";

describe("sequenceShortLabel", () => {
  it("reports lead hand + top rung for consecutive ladders", () => {
    expect(sequenceShortLabel("B1-L2-R2-L3-R3-L4-B4")).toBe("L4"); // matching ladder
    expect(sequenceShortLabel("B1-R2-L2-R3-L3-R4-B4")).toBe("R4");
    expect(sequenceShortLabel("B1-L2-R3-L4-R5-L6-B6")).toBe("L6"); // basic ladder
    expect(sequenceShortLabel("B1-R2-L3-R4-L5-R6-B6")).toBe("R6");
  });

  it("encodes every rung gap for max ladders, including trailing zeros", () => {
    expect(sequenceShortLabel("B1-L3-R4-B4")).toBe("L+1+0");
    expect(sequenceShortLabel("B1-R3-L4-B4")).toBe("R+1+0");
    expect(sequenceShortLabel("B1-L3-R5-B5")).toBe("L+1+1");
    expect(sequenceShortLabel("B1-R3-L5-B5")).toBe("R+1+1");
  });

  it("keeps the max-ladder variants distinct", () => {
    const labels = CAMPUS_TEMPLATE.filter((s) => s.name === "Max Ladder").map((s) =>
      sequenceShortLabel(s.sequence),
    );
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("falls back to the raw string for unparseable sequences", () => {
    expect(sequenceShortLabel("free climbing")).toBe("free climbing");
    expect(sequenceShortLabel("")).toBe("");
  });
});

describe("shortCodeToSequence", () => {
  it("expands skip codes into full sequences", () => {
    expect(shortCodeToSequence("R+1+2")).toBe("B1-R3-L6-B6");
    expect(shortCodeToSequence("L+1+1")).toBe("B1-L3-R5-B5");
    expect(shortCodeToSequence("L+1")).toBe("B1-L3-B3");
  });

  it("expands top-rung codes into consecutive ladders", () => {
    expect(shortCodeToSequence("L4")).toBe("B1-L2-R3-L4-B4");
    expect(shortCodeToSequence("R6")).toBe("B1-R2-L3-R4-L5-R6-B6");
  });

  it("round-trips with sequenceShortLabel", () => {
    for (const code of ["R+1+2", "L+1+1", "L+1+0", "L4", "R6", "L2"]) {
      expect(sequenceShortLabel(shortCodeToSequence(code)!)).toBe(code);
    }
  });

  it("rejects non-codes and degenerate input", () => {
    expect(shortCodeToSequence("B1-L2-R2")).toBeNull();
    expect(shortCodeToSequence("L")).toBeNull();
    expect(shortCodeToSequence("L1")).toBeNull();
    expect(shortCodeToSequence("hello")).toBeNull();
  });
});

describe("ladderDisplayName", () => {
  it("strips a trailing 'Ladder'", () => {
    expect(ladderDisplayName("Matching Ladder")).toBe("Matching");
    expect(ladderDisplayName("Basic Ladder")).toBe("Basic");
    expect(ladderDisplayName("Max Ladder")).toBe("Max");
  });
  it("leaves other names untouched", () => {
    expect(ladderDisplayName("Custom Set")).toBe("Custom Set");
  });
});

describe("rungShortLabel", () => {
  it("returns the first letter", () => {
    expect(rungShortLabel("Large")).toBe("L");
    expect(rungShortLabel("Medium")).toBe("M");
    expect(rungShortLabel("Small")).toBe("S");
    expect(rungShortLabel("")).toBe("");
  });
});
