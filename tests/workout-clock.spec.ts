import { test, expect } from "@playwright/test";

test.describe("Workout clock", () => {
  // The hidden Test workout (/?test): prep 3s, hang 2s, rest 2s — equal hang
  // and rest, the case that used to freeze the timer after the first hang.
  test("hang and rest of equal length keep advancing", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/?test");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByTestId("tab-workout").click();
    await page.getByTestId("workout-pill-hangboard").click();
    await page.getByTestId("workout-tab-test").click();
    await page.getByTestId("start-workout-btn").click();

    await expect(page.getByTestId("phase-bar")).toContainText("rep 1", { timeout: 15_000 });
    await expect(page.getByTestId("phase-bar")).toContainText("Rest", { timeout: 5_000 });
    await expect(page.getByTestId("phase-bar")).toContainText("rep 2", { timeout: 5_000 });
  });

  test.describe("Workout A", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/");
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.getByTestId("tab-workout").click();
      await page.getByTestId("workout-pill-hangboard").click();
      await page.getByTestId("workout-tab-repeaters").click();
      await page.getByTestId("start-workout-btn").click();
    });

    test("a reload mid-workout comes back paused where it was", async ({ page }) => {
      await expect(page.getByTestId("hold-name")).toHaveText("Jug");
      await page.reload();
      await expect(page.getByTestId("pause-btn")).toHaveText("Resume");
      await expect(page.getByTestId("hold-name")).toHaveText("Jug");

      await page.getByTestId("pause-btn").click();
      await expect(page.getByTestId("pause-btn")).toHaveText("Pause");

      await page.getByTestId("bail-btn").click();
      await page.getByTestId("bail-btn").click();
      await expect(page.getByTestId("tab-workout")).toBeVisible();
      // An ended workout is not offered back on the next load.
      await page.reload();
      await expect(page.getByTestId("tab-workout")).toBeVisible();
      await expect(page.getByTestId("pause-btn")).toHaveCount(0);
    });

    test("the Done screen offers Save, not End", async ({ page }) => {
      await page.evaluate(() => {
        const store = (window as unknown as { __store: { setState: (s: object) => void } }).__store;
        store.setState({ phase: "done", phaseEndsAt: null });
      });
      await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
      await expect(page.getByTestId("bail-btn")).toHaveCount(0);
    });
  });
});
