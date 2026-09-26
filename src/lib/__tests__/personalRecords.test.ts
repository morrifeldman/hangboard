import { describe, it, expect } from "vitest";
import { bestsBefore, isPR, sessionPRs } from "../personalRecords";
import type { SessionRecord, SessionHoldRecord } from "../history";

function hold(id: string, set1: number, set2: number | null = null, set2Done = true): SessionHoldRecord {
  return {
    holdId: id,
    holdName: id,
    set1: { weight: set1, reps: 1, completed: true },
    set2: set2 === null ? null : { weight: set2, reps: 1, completed: set2Done },
  };
}

function session(id: string, day: number, holds: SessionHoldRecord[]): SessionRecord {
  return { id, workoutType: "max-hang", startedAt: day * 86_400_000, completedAt: day * 86_400_000 + 1, bailed: false, holds };
}

describe("sessionPRs", () => {
  it("doesn't count the first time on a hold", () => {
    expect(sessionPRs([session("a", 1, [hold("b-chisel", 10)])]).size).toBe(0);
  });

  it("flags a hold that beats every earlier session, whatever order they're stored in", () => {
    const prs = sessionPRs([
      session("c", 3, [hold("b-chisel", 15), hold("b-hc", 5)]),
      session("a", 1, [hold("b-chisel", 10), hold("b-hc", 5)]),
      session("b", 2, [hold("b-chisel", 5)]),
    ]);
    expect(prs.get("c")).toEqual(["b-chisel"]);
    expect(prs.has("b")).toBe(false);
  });

  it("ignores failed sets", () => {
    const prs = sessionPRs([
      session("a", 1, [hold("b-chisel", 10)]),
      session("b", 2, [hold("b-chisel", 10, 20, false)]),
    ]);
    expect(prs.size).toBe(0);
  });

  it("ignores gym sessions", () => {
    const gym: SessionRecord = { ...session("g", 2, []), workoutType: "cardio", gymData: { type: "cardio", mode: "run", durationMin: 30 } };
    expect(sessionPRs([session("a", 1, [hold("b-chisel", 10)]), gym]).size).toBe(0);
  });
});

describe("bestsBefore + isPR", () => {
  it("compares against sessions before the given time, excluding the one being edited", () => {
    const sessions = [
      session("a", 1, [hold("b-chisel", 10)]),
      session("b", 2, [hold("b-chisel", 20)]),
      session("c", 3, [hold("b-chisel", 30)]),
    ];
    const bests = bestsBefore(sessions, 2 * 86_400_000 + 5, "b");
    expect(bests.get("b-chisel")).toBe(10);
    expect(isPR("b-chisel", 15, bests)).toBe(true);
    expect(isPR("b-chisel", 10, bests)).toBe(false);
    expect(isPR("b-open", 50, bests)).toBe(false);
  });
});
