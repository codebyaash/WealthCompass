import { expect, test } from "@playwright/test";

test("dashboard shell renders current MVP surfaces", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("WealthCompass")).toBeVisible();
  await expect(page.getByText("Your investment command center")).toBeVisible();
  await expect(page.getByText("Next best action")).toBeVisible();
  await expect(page.getByText("Quick actions")).toBeVisible();
  await expect(page.getByRole("button", { name: "Update profile" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Track holdings" })).toBeVisible();
});

test("local onboarding changes survive a refresh", async ({ page }) => {
  const countryValue = "Persist QA";

  await page.goto("/");
  await page.getByRole("button", { name: "Update profile" }).click();

  await expect(page.getByText("Build your investing starting point")).toBeVisible();

  const countryField = page.getByLabel("Country");
  await countryField.fill(countryValue);
  await page.getByRole("button", { name: "Next step" }).click();
  await page.getByRole("button", { name: "Next step" }).click();
  await page.getByRole("button", { name: "Submit assessment" }).click();

  await expect(countryField).toHaveValue(countryValue);
  await expect(page.getByText("Local saved")).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "Update profile" }).click();

  await expect(page.getByLabel("Country")).toHaveValue(countryValue);
});
