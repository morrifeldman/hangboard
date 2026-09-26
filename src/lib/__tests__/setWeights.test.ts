import { describe, it, expect } from "vitest";
import { plannedWeight, sessionSetWeight } from "../setWeights";
import type { SetOverrides } from "../setWeights";
import type { HoldDefinition } from "../../data/holds";

const maxHang: HoldDefinition = {
  id: "b-test",
  name: "Max Hang",
  defaultSet1Weight: 0,
  defaultSet2Weight: 0,
  set1Reps: 1,
  set2Reps: 1,
  numSets: 3,
  setIncrement: 5,
};

const repeater: HoldDefinition = {
  id: "large-edge",
  name: "Large Edge",
  defaultSet1Weight: 5,
  defaultSet2Weight: 15,
  set1Reps: 7,
  set2Reps: 6,
};

const none: SetOverrides = { set1: null, set2: null };

describe("plannedWeight", () => {
  it("derives max-hang sets from set1 plus the increment", () => {
    const stored = { set1: 10, set2: 99 };
    expect([1, 2, 3].map((n) => plannedWeight(maxHang, stored, n))).toEqual([10, 15, 20]);
  });

  it("reads repeater sets straight from storage", () => {
    expect(plannedWeight(repeater, { set1: 0, set2: 7.5 }, 2)).toBe(7.5);
  });

  it("falls back to hold defaults when nothing is stored", () => {
    expect(plannedWeight(repeater, undefined, 1)).toBe(5);
    expect(plannedWeight(repeater, undefined, 2)).toBe(15);
  });
});

describe("sessionSetWeight — max hang", () => {
  const stored = { set1: 10, set2: 15 };
  const weights = (o: SetOverrides | undefined) =>
    [1, 2, 3].map((n) => sessionSetWeight(maxHang, stored, o, n));

  it("matches the plan with no overrides", () => {
    expect(weights(undefined)).toEqual([10, 15, 20]);
    expect(weights(none)).toEqual([10, 15, 20]);
  });

  it("carries a set-1 override forward to later sets", () => {
    expect(weights({ ...none, set1: 12.5 })).toEqual([12.5, 17.5, 22.5]);
  });

  it("carries a set-2 override forward to set 3", () => {
    expect(weights({ ...none, set1: 12.5, set2: 20 })).toEqual([12.5, 20, 25]);
  });

  it("keeps an explicit later override when an earlier set changes", () => {
    expect(weights({ set1: 15, set2: null, set3: 18 })).toEqual([15, 20, 18]);
  });
});

describe("sessionSetWeight — repeaters", () => {
  const stored = { set1: 5, set2: 15 };
  const weights = (o: SetOverrides | undefined) =>
    [1, 2].map((n) => sessionSetWeight(repeater, stored, o, n));

  it("shifts set 2 by the same amount set 1 moved", () => {
    expect(weights({ ...none, set1: 2.5 })).toEqual([2.5, 12.5]);
  });

  it("leaves an overridden set 2 alone", () => {
    expect(weights({ set1: 2.5, set2: 17.5 })).toEqual([2.5, 17.5]);
  });

  it("does not touch set 1 when only set 2 moves", () => {
    expect(weights({ ...none, set2: 12.5 })).toEqual([5, 12.5]);
  });
});
