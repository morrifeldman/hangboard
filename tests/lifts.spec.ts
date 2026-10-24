import { test, expect, type Page } from "@playwright/test";

// Lifts live in the persisted store; each test starts from an empty library.
const library = (page: Page) =>
  page.evaluate(() => (window as unknown as { __store: { getState: () => { lifts: unknown[] } } }).__store.getState().lifts);

const card = (page: Page) => page.getByTestId("lift-card");
const setWeights = (page: Page) =>
  card(page).getByRole("button", { name: /^Set \d+ weight/ }).allInnerTexts();

async function openLifts(page: Page) {
  await page.goto("/workout?test");
  await page.getByRole("button", { name: "Lifts", exact: true }).click();
}

async function save(page: Page) {
  await page.getByRole("button", { name: "Save session" }).click();
  await expect(page).toHaveURL(/\/history/);
}

test("a new lift keeps an off-grid base and joins the library on save", async ({ page }) => {
  await openLifts(page);
  await page.getByLabel("Lift name").fill("Bench");
  await card(page).getByRole("spinbutton").fill("42");
  await card(page).getByRole("button", { name: /^± lb, / }).click();
  await card(page).getByRole("button", { name: "± lb +2.5" }).click();
  await card(page).getByRole("button", { name: "± lb +2.5" }).click();

  // Steps round to plates, but the 42 lb bar itself is left alone.
  await expect.poll(() => setWeights(page)).toEqual(["42", "47", "52"]);

  await card(page).getByRole("button", { name: "Set 1 done" }).click();
  await save(page);
  await expect(page.getByText(/Bench/).first()).toBeVisible();

  expect(await library(page)).toMatchObject([
    { name: "Bench", baseWeight: 42, sets: 3, reps: 5, repDiff: 0, weightDiff: 5 },
  ]);
});

test("a library lift is edited from the workout page and saved back", async ({ page }) => {
  await openLifts(page);
  await page.evaluate(() =>
    (window as unknown as { __store: { setState: (s: object) => void } }).__store.setState({
      lifts: [{ id: "bench", name: "Bench", baseWeight: 42, sets: 3, reps: 8, repDiff: -1, weightDiff: 5 }],
    }),
  );

  await page.getByLabel("Lift name").fill("Bench");
  await expect(card(page).getByText("42 · 3×8 −1 rep +5 lb")).toBeVisible();
  await expect.poll(() => setWeights(page)).toEqual(["42", "47", "52"]);

  await card(page).getByRole("button", { name: "Edit", exact: true }).click();
  await expect(card(page).getByText("Saving updates Bench for next time")).toBeVisible();
  await card(page).getByRole("button", { name: /^Sets, / }).click();
  await card(page).getByRole("button", { name: "Sets +1" }).click();
  await card(page).getByRole("button", { name: "Done", exact: true }).click();

  await expect(card(page).getByText("42 · 4×8 −1 rep +5 lb")).toBeVisible();
  await expect.poll(() => setWeights(page)).toEqual(["42", "47", "52", "57"]);

  // Next base steps from 42, not from the nearest multiple of 2.5.
  await card(page).getByRole("button", { name: "+2.5" }).click();
  await expect(card(page).getByText("44.5")).toBeVisible();

  await card(page).getByRole("button", { name: "Set 1 done" }).click();
  await save(page);

  expect(await library(page)).toEqual([
    { id: "bench", name: "Bench", baseWeight: 44.5, sets: 4, reps: 8, repDiff: -1, weightDiff: 5 },
  ]);

  // Editing the logged session doesn't offer to change the lift.
  await page.getByText(/Bench/).first().click();
  await expect(card(page)).toBeVisible();
  await expect(card(page).getByRole("button", { name: "Edit", exact: true })).toHaveCount(0);
});
