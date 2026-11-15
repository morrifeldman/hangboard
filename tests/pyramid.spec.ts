import { test, expect } from "@playwright/test";

const CSV =
  'Date,Route,Rating,Notes,URL,Pitches,Location,"Avg Stars","Your Stars",Style,"Lead Style","Route Type","Your Rating",Length,"Rating Code"\n' +
  "2024-03-15,Power Surge,5.12a,,https://www.mountainproject.com/route/105717718/power-surge,1,Somewhere > Crag,3.5,4,Lead,Redpoint,Sport,,80,6600\n" +
  "2024-04-02,Easy Street,5.10a,,https://www.mountainproject.com/route/105717719/easy-street,1,Somewhere > Crag,2.5,3,Lead,Onsight,Sport,,60,2600\n";

test("friends: add one by search, see their pyramid, then remove them", async ({ page }) => {
  await page.route("**/api/search-mp-users?*", (route) =>
    route.fulfill({
      json: {
        results: {
          Users: [
            '<a href="https://www.mountainproject.com/user/111/ada-climber?search=1">' +
              '<div class="text-truncate">Ada Climber</div><div class="small"></div></a>',
          ],
        },
      },
    }),
  );
  let exportRequested = "";
  await page.route("**/api/fetch-mp-csv?*", (route) => {
    exportRequested = new URL(route.request().url()).searchParams.get("url") ?? "";
    return route.fulfill({ contentType: "text/csv", body: CSV });
  });

  await page.goto("/pyramid");
  await page.getByTestId("pyramid-friends").click();
  await expect(page.getByRole("heading", { name: "Friends", exact: true })).toBeVisible();

  await page.getByTestId("settings-mp-search").fill("Ada");
  await page.getByTestId("settings-mp-search-submit").click();
  await page.getByTestId("settings-mp-result").click();

  // They join the list above, highlighted, and the search stays put.
  await expect(page.getByTestId("friend-row")).toContainText("Ada Climber");
  await expect(page.getByTestId("friend-row")).toHaveAttribute("data-flash", "true");
  await expect(page.getByTestId("settings-mp-result")).toContainText("Added");
  await expect(page).toHaveURL(/\/friends$/);

  // Tapping them opens their pyramid, drawn from their ticks.
  await page.getByTestId("friend-row").getByText("Ada Climber").click();
  await expect(page).toHaveURL(/\/pyramid\?who=111$/);
  expect(exportRequested).toBe("https://www.mountainproject.com/user/111/ada-climber/tick-export");
  await expect(page.getByTestId("pyramid-friend-info")).toContainText("Ada Climber · 2 ticks");
  await expect(page.getByRole("button", { name: "Ada Climber", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("5.12a").first()).toBeVisible();

  // Your own climbs are untouched: "Me" is still empty.
  await page.getByRole("button", { name: "Me", exact: true }).click();
  await expect(page).toHaveURL(/\/pyramid$/);
  await expect(page.getByText("No climbs yet")).toBeVisible();

  // Survives a reload, and can be removed.
  await page.reload();
  await page.getByTestId("pyramid-friends").click();
  await expect(page.getByTestId("friend-row")).toContainText("2 ticks");
  await page.getByRole("button", { name: "Remove Ada Climber" }).click();
  await page.getByRole("button", { name: "Confirm removing Ada Climber" }).click();
  await expect(page.getByTestId("friend-row")).toHaveCount(0);

  // A link to a friend who is gone falls back to your own climbs.
  await page.goto("/pyramid?who=111");
  await expect(page).toHaveURL(/\/pyramid$/);
});

test("pyramid: a toggle says what it switched to, then the caption goes away", async ({ page }) => {
  await page.goto("/pyramid");
  await page.getByRole("button", { name: "Toggle sends only" }).click();
  await expect(page.getByTestId("toggle-caption")).toHaveText("Including top rope and attempts");
  await page.getByRole("button", { name: "Toggle counts" }).click();
  await expect(page.getByTestId("toggle-caption")).toHaveText("Showing counts per grade");
  await expect(page.getByTestId("toggle-caption")).toHaveCount(0, { timeout: 5000 });

  await page.goto("/pyramid/scrolling");
  await page.getByRole("button", { name: "Sort: newest first" }).click();
  await expect(page.getByTestId("toggle-caption")).toHaveText("Oldest first");
});
