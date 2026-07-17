import { expect, test, type Page } from "@playwright/test";

const e2eEmail = process.env.WEALTHCOMPASS_E2E_EMAIL;
const e2ePassword = process.env.WEALTHCOMPASS_E2E_PASSWORD;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

test.describe("signed-in cloud sync", () => {
  test.skip(
    !e2eEmail || !e2ePassword || !supabaseUrl || !supabaseAnonKey,
    "Set Supabase env vars plus WEALTHCOMPASS_E2E_EMAIL and WEALTHCOMPASS_E2E_PASSWORD to run signed-in cloud sync verification.",
  );

  async function signIn(page: Page) {
    await page.goto("/auth");
    await page.getByRole("button", { name: "Use existing account" }).click();

    await page.getByLabel("Email").fill(e2eEmail!);
    await page.getByLabel("Password").fill(e2ePassword!);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText(e2eEmail!)).toBeVisible();
  }

  test("signed-in onboarding changes survive a full refresh", async ({ page }) => {
    const countryValue = `Persist Cloud ${Date.now()}`;

    await signIn(page);

    await page.getByRole("button", { name: "Update profile" }).click();
    await expect(page.getByText("Tell WealthCompass about yourself")).toBeVisible();

    const countryField = page.getByLabel("Country");
    await countryField.fill(countryValue);
    await expect(countryField).toHaveValue(countryValue);

    await expect(page.getByText("Changes pending")).toBeVisible();
    await expect(page.getByText("Cloud synced")).toBeVisible({ timeout: 20_000 });

    await page.reload();
    await expect(page.getByText(e2eEmail!)).toBeVisible();
    await page.getByRole("button", { name: "Update profile" }).click();
    await expect(page.getByLabel("Country")).toHaveValue(countryValue);
  });

  test("saved risk history survives a full refresh", async ({ page }) => {
    await signIn(page);

    await page.getByRole("button", { name: "Save Risk" }).click();
    await expect(page.getByText("Cloud synced")).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: "History" }).click();
    await expect(page.getByText("Risk profile history")).toBeVisible();

    const beforeReloadEntries = page.getByText("Risk score");
    await expect(beforeReloadEntries.first()).toBeVisible();

    await page.reload();
    await expect(page.getByText(e2eEmail!)).toBeVisible();
    await page.getByRole("button", { name: "History" }).click();
    await expect(page.getByText("Risk profile history")).toBeVisible();
    await expect(page.getByText("Risk score").first()).toBeVisible();
  });
});
