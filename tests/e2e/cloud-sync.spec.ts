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

  async function signOut(page: Page) {
    await page.getByRole("button", { name: "Sign Out" }).click();
    await expect(page.getByText(e2eEmail!)).not.toBeVisible();
  }

  async function waitForCloudSync(page: Page) {
    await expect(page.getByText("Cloud synced")).toBeVisible({ timeout: 20_000 });
  }

  test("signed-in onboarding changes survive a full refresh", async ({ page }) => {
    const countryValue = `Persist Cloud ${Date.now()}`;

    await signIn(page);

    await page.getByRole("button", { name: "Update profile" }).click();
    await expect(page.getByText("Build your investing starting point")).toBeVisible();

    const countryField = page.getByLabel("Country");
    await countryField.fill(countryValue);
    await expect(countryField).toHaveValue(countryValue);
    await page.getByRole("button", { name: "Next step" }).click();
    await page.getByRole("button", { name: "Next step" }).click();
    await page.getByRole("button", { name: "Submit assessment" }).click();

    await expect(page.getByText("Changes pending")).toBeVisible();
    await waitForCloudSync(page);

    await page.reload();
    await expect(page.getByText(e2eEmail!)).toBeVisible();
    await page.getByRole("button", { name: "Update profile" }).click();
    await expect(page.getByLabel("Country")).toHaveValue(countryValue);
  });

  test("saved risk history survives a full refresh", async ({ page }) => {
    await signIn(page);

    await page.getByRole("button", { name: "Save Risk" }).click();
    await waitForCloudSync(page);

    await page.getByRole("button", { name: "History", exact: true }).click();
    await expect(page.getByText("Risk profile history")).toBeVisible();

    const beforeReloadEntries = page.getByText("Risk score");
    await expect(beforeReloadEntries.first()).toBeVisible();

    await page.reload();
    await expect(page.getByText(e2eEmail!)).toBeVisible();
    await page.getByRole("button", { name: "History", exact: true }).click();
    await expect(page.getByText("Risk profile history")).toBeVisible();
    await expect(page.getByText("Risk score").first()).toBeVisible();
  });

  test("signed-in onboarding changes survive sign out and back in", async ({ page }) => {
    const countryValue = `Relog Persist ${Date.now()}`;

    await signIn(page);

    await page.getByRole("button", { name: "Update profile" }).click();
    await expect(page.getByText("Build your investing starting point")).toBeVisible();

    const countryField = page.getByLabel("Country");
    await countryField.fill(countryValue);
    await expect(countryField).toHaveValue(countryValue);
    await page.getByRole("button", { name: "Next step" }).click();
    await page.getByRole("button", { name: "Next step" }).click();
    await page.getByRole("button", { name: "Submit assessment" }).click();

    await expect(page.getByText("Changes pending")).toBeVisible();
    await waitForCloudSync(page);

    await signOut(page);
    await signIn(page);

    await page.getByRole("button", { name: "Update profile" }).click();
    await expect(page.getByLabel("Country")).toHaveValue(countryValue);
  });

  test("signed-in transaction journal entries survive a full refresh", async ({ page }) => {
    const uniqueAssetName = `Cloud Sync Fund ${Date.now()}`;

    await signIn(page);
    await page.getByRole("button", { name: "Portfolio" }).click();
    await expect(page.getByText("Manual portfolio tracker")).toBeVisible();

    const transactionJournal = page.getByRole("group", { name: "Transaction journal" });

    await transactionJournal.getByLabel("Asset name").fill(uniqueAssetName);
    await transactionJournal.getByLabel("Source").fill("Cloud E2E");
    await page.getByRole("button", { name: "Add transaction" }).click();

    await waitForCloudSync(page);
    await expect(page.getByText(uniqueAssetName, { exact: true })).toBeVisible();

    await page.reload();
    await expect(page.getByText(e2eEmail!)).toBeVisible();
    await page.getByRole("button", { name: "Portfolio" }).click();
    await expect(page.getByText("Manual portfolio tracker")).toBeVisible();
    await expect(page.getByText(uniqueAssetName, { exact: true })).toBeVisible();
  });

  test("signed-in goal changes survive a full refresh", async ({ page }) => {
    const goalName = `Cloud Goal ${Date.now()}`;

    await signIn(page);
    await page.getByRole("button", { name: "Goals", exact: true }).click();
    await expect(page.getByText("Multi-goal planner")).toBeVisible();

    await page.getByTestId("goals-header-add").click();
    await page.getByLabel("Goal name").first().fill(goalName);
    await page.getByLabel("Current amount").first().fill("12345");
    await page.getByLabel("Target amount").first().fill("345678");
    await page.getByLabel("Years remaining").first().fill("4");

    await waitForCloudSync(page);
    await expect(page.getByRole("heading", { name: goalName })).toBeVisible();

    await page.reload();
    await expect(page.getByText(e2eEmail!)).toBeVisible();
    await page.getByRole("button", { name: "Goals" }).click();
    await expect(page.getByText("Multi-goal planner")).toBeVisible();
    await expect(page.getByRole("heading", { name: goalName })).toBeVisible();
    await expect(page.getByLabel("Current amount").first()).toHaveValue("12345");
    await expect(page.getByLabel("Target amount").first()).toHaveValue("345678");
  });
});
