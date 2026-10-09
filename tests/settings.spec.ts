import { test, expect } from "@playwright/test";

test("settings: sections render and an unsaved Mountain Project URL guards leaving", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Backup and restore" })).toBeVisible();
  await expect(page.getByTestId("settings-mountain-project")).toBeVisible();

  await page.getByTestId("settings-mp-url").fill("https://example.com/ticks.csv");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByText("Leave without saving?")).toBeVisible();
  await page.getByRole("button", { name: "Discard and leave" }).click();
  await expect(page.getByTestId("settings-mountain-project")).toHaveCount(0);
});

test("settings: a backup downloads", async ({ page }) => {
  await page.goto("/settings");
  const download = page.waitForEvent("download");
  await page.getByTestId("settings-backup").click();
  expect((await download).suggestedFilename()).toMatch(/^cairn-backup-\d{4}-\d{2}-\d{2}\.json$/);
});
