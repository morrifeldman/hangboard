import { test, expect } from "@playwright/test";

// Uses the hidden "Test" workout (/?test): prepSecs=3, hangSecs=2, restSecs=1, breakSecs=5, repsPerSet=2

test.describe("Workout Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/?test");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByTestId("workout-tab-test").click();
  });

  test("Start workout → prep phase for first hold (Jug)", async ({ page }) => {
    await page.getByTestId("start-workout-btn").click();
    await expect(page.getByTestId("hold-name")).toHaveText("Jug");
    await expect(page.locator("svg circle").nth(1)).toBeVisible();
  });

  test("Prep auto-advances to hang phase", async ({ page }) => {
    test.setTimeout(60_000);
    await page.getByTestId("start-workout-btn").click();
    // prepSecs=3 — hang phase begins within a few seconds
    await expect(page.getByTestId("rep-counter")).toBeVisible({ timeout: 15_000 });
  });

  test("Skip set button jumps to break phase", async ({ page }) => {
    test.setTimeout(60_000);
    await page.getByTestId("start-workout-btn").click();

    // Wait for hang phase
    await expect(page.getByTestId("rep-counter")).toBeVisible({ timeout: 15_000 });

    // Skip the rest of the set
    await page.getByTestId("skip-set-btn").click();

    // Should immediately be in break phase
    await expect(page.getByTestId("skip-break-btn")).toBeVisible({ timeout: 5_000 });
  });

  test("Pause button stops timer and Resume continues it", async ({ page }) => {
    test.setTimeout(60_000);
    await page.getByTestId("start-workout-btn").click();

    // Wait for hang phase (prepSecs=3)
    await expect(page.getByTestId("rep-counter")).toBeVisible({ timeout: 15_000 });

    // Pause immediately
    await page.getByTestId("pause-btn").click();

    // Wait longer than 1s but less than hangSecs (2s) — should still be hanging
    await page.waitForTimeout(1_500);
    await expect(page.getByTestId("phase-bar")).toContainText("Hang");

    // Resume — remaining hang time expires and phase advances
    await page.getByTestId("pause-btn").click();
    await expect(page.getByTestId("phase-bar")).not.toContainText("Hang", { timeout: 5_000 });
  });
});
