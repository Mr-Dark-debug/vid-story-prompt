import { expect, test } from "@playwright/test";

for (const width of [360, 1280]) {
  test(`clipping-only product pages fit a ${width}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      "/",
      "/features",
      "/how-it-works",
      "/pricing",
      "/roadmap",
      "/docs",
      "/use-cases/youtube",
    ]) {
      await page.goto(path);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("main")).not.toContainText("Multi-track timeline");
      await expect(
        page.locator(
          'a[href="/docs/ai-editor"],a[href="/docs/timeline"],a[href="/app/projects/new"]',
        ),
      ).toHaveCount(0);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    }
    await page.goto("/pricing");
    await expect(
      page.getByRole("link", { name: "Create free account", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Planned · not yet purchasable")).toHaveCount(2);
    await expect(page.getByText("Up to 5 clips per job", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Annual pricing", exact: true })).toBeVisible();
  });
}

test("retired editor documentation redirects and leaves the sitemap", async ({ page, request }) => {
  for (const path of ["/docs/ai-editor", "/docs/timeline"]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(301);
    await page.goto(path);
    await expect(page).toHaveURL(/\/docs\/getting-started$/);
    await expect(
      page.getByRole("heading", { name: "Create your first clips", exact: true }),
    ).toBeVisible();
  }
  const sitemap = await (await request.get("/sitemap-pages.xml")).text();
  expect(sitemap).not.toContain("/docs/ai-editor");
  expect(sitemap).not.toContain("/docs/timeline");
});
