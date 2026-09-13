import { expect, test } from "@playwright/test";

for (const width of [360, 1280]) {
  test(`source status avoids simulated service success at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/status");
    await expect(page.getByRole("heading", { name: "Source access, at a glance." })).toBeVisible();
    await expect(page.getByRole("status", { name: /^Source access:/ })).toBeVisible();
    await expect(page.getByRole("status", { name: "Source access: Checking" })).toHaveCount(0, {
      timeout: 15_000,
    });
    await expect(page.getByText("Operational", { exact: true })).toHaveCount(0);
    await expect(
      page.getByText(/A healthy probe does not guarantee access to every video/),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Open your clipping jobs" })).toHaveAttribute(
      "href",
      "/app/youtube-clipper",
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await expect(page.locator("main")).not.toContainText(/proxy\.internal|warp-proxy|Bearer /);
  });
}
