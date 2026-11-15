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

test("settings: picking a Mountain Project search result fills in its tick export", async ({ page }) => {
  await page.route("**/api/search-mp-users?*", (route) =>
    route.fulfill({
      json: {
        results: {
          Users: [
            '<a href="https://www.mountainproject.com/user/111/ada-climber?search=1">' +
              '<div class="text-truncate">Ada Climber</div><div class="small">Bishop, CA</div></a>',
            '<a href="https://www.mountainproject.com/user/222/ada-other?search=1">' +
              '<div class="text-truncate">Ada Other</div><div class="small"></div></a>',
          ],
        },
      },
    }),
  );
  await page.goto("/settings");
  await page.getByTestId("settings-mp-search").fill("Ada");
  await page.getByTestId("settings-mp-search-submit").click();
  await expect(page.getByTestId("settings-mp-result")).toHaveCount(2);
  await expect(page.getByTestId("settings-mp-results")).toContainText("Bishop, CA");

  await page.getByTestId("settings-mp-result").first().click();
  await expect(page.getByTestId("settings-mp-url")).toHaveValue(
    "https://www.mountainproject.com/user/111/ada-climber/tick-export",
  );
  await expect(page.getByTestId("settings-mp-result").first()).toHaveAttribute("aria-pressed", "true");
});

test("settings: a backup downloads", async ({ page }) => {
  await page.goto("/settings");
  const download = page.waitForEvent("download");
  await page.getByTestId("settings-backup").click();
  expect((await download).suggestedFilename()).toMatch(/^cairn-backup-\d{4}-\d{2}-\d{2}\.json$/);
});
