import { test, expect } from "@playwright/test";

// Test mode: PREP_SECS=3, HANG_SECS=2, REST_SECS=1, BREAK_SECS=5

test.describe("Workout Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test("Start workout → prep phase for first hold (Jug)", async ({ page }) => {
    await page.getByTestId("start-workout-btn").click();
    await expect(page.getByTestId("hold-name")).toHaveText("Jug");
    await expect(page.locator("svg circle").nth(1)).toBeVisible();
  });

  test("Prep auto-advances to hang phase", async ({ page }) => {
    test.setTimeout(60_000);
    await page.getByTestId("start-workout-btn").click();
    // Wait for prep to expire and hanging phase to begin (up to 15s covers both test and real timers)
    await expect(page.getByTestId("rep-counter")).toBeVisible({ timeout: 15_000 });
  });

  test("Full set 1 → break transition", async ({ page }) => {
    test.setTimeout(120_000);
    await page.getByTestId("start-workout-btn").click();
    await expect(page.getByTestId("skip-break-btn")).toBeVisible({ timeout: 60_000 });
  });

  test("Skip break → prep for set 2", async ({ page }) => {
    test.setTimeout(120_000);
    await page.getByTestId("start-workout-btn").click();
    await expect(page.getByTestId("skip-break-btn")).toBeVisible({ timeout: 60_000 });
    await page.getByTestId("skip-break-btn").click();
    await expect(page.locator("text=2 / 2")).toBeVisible();
  });

  test("Jug set 2 completes → break → prep for Large Edge", async ({ page }) => {
    test.setTimeout(180_000);
    await page.getByTestId("start-workout-btn").click();
    // Skip set 1 break
    await expect(page.getByTestId("skip-break-btn")).toBeVisible({ timeout: 60_000 });
    await page.getByTestId("skip-break-btn").click();
    // Wait for set 2 to finish, then skip that break too
    await expect(page.getByTestId("skip-break-btn")).toBeVisible({ timeout: 60_000 });
    await page.getByTestId("skip-break-btn").click();
    // Should now be on Large Edge (hold 2)
    await expect(page.getByTestId("hold-name")).toHaveText("Large Edge", { timeout: 10_000 });
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

    // Wait for hang phase (prep is 3s in test mode)
    await expect(page.getByTestId("rep-counter")).toBeVisible({ timeout: 15_000 });

    // Pause immediately
    await page.getByTestId("pause-btn").click();

    // Wait longer than HANG_SECS (2s) — should still be hanging
    await page.waitForTimeout(2_500);
    await expect(page.getByTestId("phase-bar")).toContainText("Hang");

    // Resume — remaining hang time expires and phase advances
    await page.getByTestId("pause-btn").click();
    await expect(page.getByTestId("phase-bar")).not.toContainText("Hang", { timeout: 5_000 });
  });
});
