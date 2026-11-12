import { describe, it, expect } from "vitest";
import { mountainProjectIntentUrl } from "../mountainProjectLink";

describe("mountainProjectIntentUrl", () => {
  it("targets the Mountain Project app with the web page as fallback", () => {
    const url = "https://www.mountainproject.com/route/105717718/power-surge";
    expect(mountainProjectIntentUrl(url)).toBe(
      "intent://www.mountainproject.com/route/105717718/power-surge" +
        "#Intent;scheme=https;package=com.mountainproject.android;" +
        "S.browser_fallback_url=https%3A%2F%2Fwww.mountainproject.com%2Froute%2F105717718%2Fpower-surge;end",
    );
  });
});
