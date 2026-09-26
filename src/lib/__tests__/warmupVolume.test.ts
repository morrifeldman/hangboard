import { describe, expect, it } from "vitest";
import { plannedReps, warmupVolume } from "../../data/holds";
import { HOLDS_B } from "../../data/workout-b";

const byId = (id: string) => HOLDS_B.find((h) => h.id === id)!;

describe("warmupVolume", () => {
  it("counts repeated single hangs", () => {
    expect(warmupVolume([1, 1])).toBe("×2");
  });

  it("counts reps inside one set", () => {
    expect(warmupVolume([3])).toBe("×3");
  });

  it("keeps the split when sets have several reps", () => {
    expect(warmupVolume([7, 6])).toBe("7 + 6");
  });

  it("matches the max-hang warm-up plan", () => {
    expect(warmupVolume(plannedReps(byId("b-big-chisel")))).toBe("×3");
    expect(warmupVolume(plannedReps(byId("b-pullup")))).toBe("×2");
    expect(warmupVolume(plannedReps(byId("b-small-hc-wu")))).toBe("×1");
  });
});
