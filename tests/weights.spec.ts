import { test, expect } from "@playwright/test";

test.describe("Weight persistence", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test("Custom weight persists after reload", async ({ page }) => {
    await page.evaluate(() => {
      const data = {
        state: {
          weights: {
            jug: { set1: 0, set2: 0 },
            "large-edge": { set1: 5, set2: 15 },
            "mr-shallow": { set1: -30, set2: -20 },
            "small-edge": { set1: -20, set2: -10 },
            "imr-shallow": { set1: 10, set2: 0 },
            "wide-pinch": { set1: -45, set2: -35 },
            sloper: { set1: -17.5, set2: -7.5 },
            "med-pinch": { set1: -50, set2: -40 },
          },
        },
        version: 0,
      };
      localStorage.setItem("hangboard-weights", JSON.stringify(data));
    });
    await page.reload();
    await expect(page.getByTestId("weight-mr-shallow-set1")).toHaveText("-30");
  });

  test("Weights persist across reload", async ({ page }) => {
    await expect(page.getByTestId("weight-sloper-set1")).toHaveText("-17.5");
    await expect(page.getByTestId("weight-sloper-set2")).toHaveText("-7.5");
    await page.reload();
    await expect(page.getByTestId("weight-sloper-set1")).toHaveText("-17.5");
  });
});
