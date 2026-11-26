import { describe, it, expect } from "vitest";
import { ascentSummary } from "../climbUtils";
import type { ClimbStyle } from "../../constants/climbGrades";

const t = (date: string, style: ClimbStyle, climbs = 1) => ({ date, style, climbs });

describe("ascentSummary", () => {
  it("is silent for onsight, flash and top rope", () => {
    expect(ascentSummary(t("2024-01-01", "flash"), [t("2024-01-01", "flash")])).toBeNull();
    expect(ascentSummary(t("2024-01-01", "onsight"), [t("2024-01-01", "onsight")])).toBeNull();
    expect(ascentSummary(t("2024-01-01", "toprope"), [t("2024-01-01", "toprope", 3)])).toBeNull();
  });

  it("counts tries and sessions up to the first redpoint; repeats after don't change it", () => {
    const ticks = [
      t("2024-03-01", "attempt", 2),
      t("2024-03-15", "redpoint", 3),
      t("2024-05-01", "redpoint", 1),
      t("2024-06-01", "attempt", 2),
    ];
    expect(ascentSummary(t("2024-03-15", "redpoint"), ticks)).toBe("after 4 attempts over 2 sessions");
    // A repeat's card says nothing.
    expect(ascentSummary(t("2024-05-01", "redpoint"), ticks)).toBeNull();
  });

  it("counts top-rope tries before the send", () => {
    const ticks = [t("2024-03-01", "toprope", 2), t("2024-03-15", "redpoint", 1)];
    expect(ascentSummary(t("2024-03-15", "redpoint"), ticks)).toBe("after 2 attempts over 2 sessions");
  });

  it("leaves out sessions for a one-day redpoint, and says nothing with no logged falls", () => {
    expect(ascentSummary(t("2024-03-15", "redpoint"), [t("2024-03-15", "redpoint", 2)])).toBe("after 1 attempt");
    expect(ascentSummary(t("2024-03-15", "redpoint"), [t("2024-03-15", "redpoint", 1)])).toBeNull();
  });

  it("counts an unsent project to date, or whole", () => {
    const ticks = [t("2024-03-01", "attempt", 2), t("2024-03-15", "attempt", 3)];
    expect(ascentSummary(t("2024-03-01", "attempt"), ticks)).toBe("2 attempts");
    expect(ascentSummary(t("2024-03-01", "attempt"), ticks, true)).toBe("5 attempts over 2 sessions");
  });
});
