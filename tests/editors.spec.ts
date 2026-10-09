import { test, expect } from "@playwright/test";

// The shared editor flow: save closes the screen, edits reload the record,
// delete takes two taps, and leaving with unsaved work asks first.
test("note: create, edit, guard unsaved changes, delete", async ({ page }) => {
  const text = `e2e note ${Date.now()}`;
  await page.goto("/history");
  await page.getByRole("button", { name: "Add note" }).click();
  await page.getByPlaceholder("Notes…").fill(text);
  await page.getByRole("button", { name: "Save note" }).click();
  await expect(page.getByText(text)).toBeVisible();

  await page.getByText(text).click();
  await expect(page.getByRole("heading", { name: "Edit note" })).toBeVisible();
  await page.getByPlaceholder("Notes…").fill(`${text} edited`);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByText("Leave without saving?")).toBeVisible();
  await page.getByRole("button", { name: "Keep editing" }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText(`${text} edited`)).toBeVisible();

  await page.getByText(`${text} edited`).click();
  await page.getByRole("button", { name: "Delete note" }).click();
  await page.getByRole("button", { name: "Tap again to delete" }).click();
  await expect(page.getByText(`${text} edited`)).toHaveCount(0);
});
