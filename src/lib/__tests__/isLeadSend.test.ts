import { describe, expect, it } from "vitest";
import { isLeadSend } from "../climbUtils";

describe("isLeadSend", () => {
  it("keeps clean lead ascents", () => {
    expect(isLeadSend({ style: "onsight" })).toBe(true);
    expect(isLeadSend({ style: "flash" })).toBe(true);
    expect(isLeadSend({ style: "redpoint" })).toBe(true);
  });

  it("puts top rope with attempts, behind the sends-only toggle", () => {
    expect(isLeadSend({ style: "toprope" })).toBe(false);
    expect(isLeadSend({ style: "attempt" })).toBe(false);
  });
});
