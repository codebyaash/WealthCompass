import { expect, test } from "@playwright/test";

test("landing dashboard flow renders key MVP surfaces", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("WealthCompass")).toBeVisible();
  await expect(page.getByText("Find your financial direction.")).toBeVisible();

  await page.getByRole("button", { name: /continue with demo workspace/i }).click();

  await expect(page.getByText("Next best action")).toBeVisible();
  await expect(page.getByText("Manual portfolio tracker")).toBeVisible();
});
