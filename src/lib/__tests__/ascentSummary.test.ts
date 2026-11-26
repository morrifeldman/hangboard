import { describe, it, expect } from "vitest";
import { ascentSummary, countToFirstSend, firstAscent, impossibleTickIds, tileFailures } from "../climbUtils";
import type { ClimbStyle } from "../../constants/climbGrades";

const t = (date: string, style: ClimbStyle, climbs = 1) => ({ date, style, climbs });

describe("countToFirstSend", () => {
  it("stops at the first real ascent; repeats and later falls don't count", () => {
    const ticks = [
      t("2024-06-01", "attempt", 2),
      t("2024-05-01", "redpoint", 1),
      t("2024-03-15", "redpoint", 3),
      t("2024-03-01", "attempt", 2),
    ];
    expect(countToFirstSend(ticks)).toEqual({ tries: 5, sessions: 2, sent: true });
  });
  it("counts top-rope ticks before the send, and every tick when there's no send", () => {
    expect(countToFirstSend([t("2024-03-01", "toprope", 2), t("2024-03-15", "flash")])).toEqual({ tries: 3, sessions: 2, sent: true });
    expect(countToFirstSend([t("2024-03-01", "attempt", 2), t("2024-03-15", "toprope", 1)])).toEqual({ tries: 3, sessions: 2, sent: false });
  });
  it("counts two ticks on one day as one session", () => {
    expect(countToFirstSend([t("2024-03-01", "attempt", 2), t("2024-03-01", "redpoint")]).sessions).toBe(1);
  });
});

describe("ascentSummary", () => {
  it("is silent for onsight and flash", () => {
    expect(ascentSummary(t("2024-01-01", "flash"), [t("2024-01-01", "flash")])).toBeNull();
    expect(ascentSummary(t("2024-01-01", "onsight"), [t("2024-01-01", "onsight"), t("2024-02-01", "attempt", 3)])).toBeNull();
  });
  it("gives falls and sessions to the redpoint", () => {
    const ticks = [t("2024-03-01", "attempt", 2), t("2024-03-15", "redpoint", 3), t("2024-06-01", "attempt", 2)];
    expect(ascentSummary(t("2024-03-15", "redpoint"), ticks)).toBe("after 4 attempts over 2 sessions");
    expect(ascentSummary(t("2024-03-15", "redpoint"), [t("2024-03-15", "redpoint", 2)])).toBe("after 1 attempt");
  });
  it("totals a project not sent yet", () => {
    expect(ascentSummary(t("2024-03-01", "attempt"), [t("2024-03-01", "attempt", 2), t("2024-03-15", "attempt", 3)])).toBe(
      "5 attempts over 2 sessions",
    );
  });
});


describe("tileFailures", () => {
  it("is falls before the send", () => {
    expect(tileFailures({ style: "redpoint", climbs: 2 })).toBe(1); // second go: no number shown
    expect(tileFailures({ style: "redpoint", climbs: 3 })).toBe(2);
    expect(tileFailures({ style: "flash", climbs: 1 })).toBe(0);
  });
  it("counts every try when there's no send", () => {
    expect(tileFailures({ style: "attempt", climbs: 3 })).toBe(3);
    expect(tileFailures({ style: "toprope", climbs: 2 })).toBe(2);
  });
});

describe("firstAscent", () => {
  it("is the earliest send, not the best", () => {
    const rp = t("2024-01-01", "redpoint");
    expect(firstAscent([t("2024-02-01", "flash"), rp, t("2023-12-01", "attempt", 3)])).toBe(rp);
  });
  it("is null with no lead send", () => {
    expect(firstAscent([t("2024-01-01", "toprope"), t("2024-01-02", "attempt")])).toBeNull();
  });
});

describe("impossibleTickIds", () => {
  const tick = (id: string, date: string, style: ClimbStyle) => ({ id, date, style });
  it("flags an onsight or flash after any earlier tick", () => {
    const ids = impossibleTickIds([
      tick("a", "2024-01-01", "toprope"),
      tick("b", "2024-02-01", "flash"),
      tick("c", "2024-03-01", "onsight"),
      tick("d", "2024-03-01", "redpoint"),
    ]);
    expect([...ids].sort()).toEqual(["b", "c"]);
  });
  it("leaves a first-day flash alone, even next to other ticks that day", () => {
    expect(impossibleTickIds([tick("a", "2024-01-01", "flash"), tick("b", "2024-01-01", "attempt")]).size).toBe(0);
  });
});
