import { describe, it, expect } from "vitest";
import type { GymData } from "../history";
import { gymSummaryParts, sessionLabel, sessionSummary, summaryText } from "../sessionSummary";

const text = (d: GymData) => summaryText(gymSummaryParts(d));

describe("sessionSummary", () => {
  it("labels sessions with History's wording", () => {
    expect(sessionLabel({ workoutType: "max-hang" })).toBe("Max Hang");
    expect(sessionLabel({ workoutType: "pe-route" })).toBe("PE Route Intervals");
  });

  it("returns null without gym data", () => {
    expect(sessionSummary({})).toBeNull();
  });

  it("summarises gym types", () => {
    expect(text({ type: "arc", climbMin: 40, routes: 6, downclimb: "Some", maxGrade: "5.10a" }))
      .toBe("40 min · 6 routes · some downclimb · Max 5.10a");
    expect(text({ type: "cir", repeats: 4, avgRestSec: 90 })).toBe("4 repeats · ~90s rest");
    expect(text({ type: "performance", grade: "5.12a", tries: 3, success: "No" }))
      .toBe("5.12a · 3 tries · no send");
    expect(text({ type: "wbl", topV: "V4", durationMin: 30 })).toBe("Top V4 · 30 min");
    expect(text({ type: "stretching", reps: 3, holdSec: 30, stretches: ["Calves"] }))
      .toBe("3 × 30s · Calves");
    expect(text({ type: "cardio", mode: "Bike", durationMin: 45, intensity: "Easy" }))
      .toBe("Bike · 45 min · Easy");
    expect(text({ type: "campus", sets: [{ rung: "a", name: "b", sequence: "c" }] })).toBe("1 set");
  });

  it("uses a dash for empty summaries", () => {
    expect(text({ type: "injury" })).toBe("—");
    expect(text({ type: "stretching" })).toBe("—");
    expect(text({ type: "lifts", lifts: [] })).toBe("—");
  });

  it("marks figures so History can style them", () => {
    const parts = gymSummaryParts({ type: "wbl", topV: "V4", durationMin: 30 });
    expect(parts[0]).toEqual([{ text: "Top " }, { text: "V4", fig: true }]);
    expect(parts[1]).toEqual([{ text: "30", fig: true }, { text: " min" }]);
  });
});
