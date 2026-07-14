import { expect, test } from "@playwright/test";
test("public clipper presents the complete authorised-source flow", async ({ page }) => {
  await page.goto("/youtube-clipper");
  await expect(
    page.getByRole("heading", { name: "Turn one long video into clips worth watching." }),
  ).toBeVisible();
  await expect(page.getByLabel("YouTube video URL")).toBeVisible();
  await expect(page.getByText("Interactive demonstration")).toBeVisible();
  await expect(
    page.getByText("Only upload or process content you own or are authorised to use."),
  ).toBeVisible();
});
test("protected clipper preserves the return URL", async ({ page }) => {
  await page.goto("/app/youtube-clipper/new");
  await expect(page).toHaveURL(/\/login\?redirect=/);
  await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
});

test("signup visibly verifies the visitor before enabling account creation", async ({ page }) => {
  await page.goto("/signup");

  await expect(page.getByRole("heading", { name: "Create your workspace." })).toBeVisible();
  await expect(page.getByText("Security verification")).toBeVisible();
  await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/, {
    timeout: 15_000,
  });
  await expect(page.getByRole("button", { name: "Sign up with Google" })).toBeEnabled({
    timeout: 15_000,
  });
  await expect(page.getByRole("button", { name: "Create free account" })).toBeEnabled();
});
