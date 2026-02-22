import { test, expect } from "@playwright/test";
import { HOLDS } from "../src/data/holds";

test.describe("Home Screen", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test("renders all holds", async ({ page }) => {
    for (const hold of HOLDS) {
      const row = page.getByTestId(`hold-row-${hold.id}`);
      await expect(row).toBeVisible();
      await expect(row).toContainText(hold.name);
    }
  });

  test("shows default weights formatted correctly", async ({ page }) => {
    await expect(page.getByTestId("weight-jug-set1")).toHaveText("BW");
    await expect(page.getByTestId("weight-jug-set2")).toHaveText("BW");
    await expect(page.getByTestId("weight-mr-shallow-set1")).toHaveText("-35");
    await expect(page.getByTestId("weight-mr-shallow-set2")).toHaveText("-25");
    await expect(page.getByTestId("weight-imr-shallow-set1")).toHaveText("+10");
    await expect(page.getByTestId("weight-large-edge-set1")).toHaveText("+5");
    await expect(page.getByTestId("weight-large-edge-set2")).toHaveText("+15");
  });

  test("Start Workout button is visible", async ({ page }) => {
    await expect(page.getByTestId("start-workout-btn")).toBeVisible();
  });
});
