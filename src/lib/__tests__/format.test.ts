import { describe, it, expect } from "vitest";
import { ordinal } from "../format";

describe("ordinal", () => {
  it("adds the English suffix", () => {
    expect([1, 2, 3, 4, 10].map(ordinal)).toEqual(["1st", "2nd", "3rd", "4th", "10th"]);
    expect([11, 12, 13, 21, 22, 23, 101, 111].map(ordinal)).toEqual(
      ["11th", "12th", "13th", "21st", "22nd", "23rd", "101st", "111th"],
    );
  });
});
