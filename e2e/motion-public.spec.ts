import { expect, test } from "@playwright/test";

test.describe("original motion public pages", () => {
  test.setTimeout(60_000);
  test("filters original briefs and resolves collection and missing prompt paths", async ({
    page,
  }) => {
    await page.goto("/prompts");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Good motion starts");
    await expect(page.getByRole("status", { name: "Motion results" })).toHaveAttribute(
      "data-hydrated",
      "true",
      { timeout: 15_000 },
    );
    await page.getByRole("button", { name: /^Data stories/ }).click();
    await expect(page.getByRole("status", { name: "Motion results" })).toContainText("2 prompts");
    await expect(page.getByRole("heading", { name: "Three days of reading" })).toBeVisible();
    await page.getByRole("searchbox", { name: "Search", exact: true }).fill("allocation");
    await expect(page.getByRole("status", { name: "Motion results" })).toContainText("1 prompt");
    await page.goto("/prompts/claude-opus-5-5");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Claude motion graphics prompts",
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://vidrial.vercel.app/prompts/claude-opus-5-5",
    );
    const missing = await page.goto("/prompts/no-such-original");
    expect(missing?.status()).toBe(404);
  });

  test("signed-out use hands an opaque private draft to signup", async ({ page }) => {
    await page.goto("/prompts/words-with-weight");
    await page.getByRole("button", { name: "Try this prompt in Vidrial" }).click();
    await expect(page).toHaveURL(/\/signup\?redirect=/);
    const redirect = new URL(page.url()).searchParams.get("redirect");
    expect(redirect).toMatch(/^\/app\/motion\/new\?draft=[a-f0-9-]{36}$/);
    expect(page.url()).not.toContain("Small%20steps");
    const saved = await page.evaluate(() => {
      const id = sessionStorage.getItem("vidrial.motion.draft.latest");
      return id ? JSON.parse(sessionStorage.getItem(`vidrial.motion.draft.${id}`) ?? "null") : null;
    });
    expect(saved.draft.prompt).toContain("Small steps. Clear direction. Keep going.");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Create your workspace");
  });

  test("gallery and guide fit 360px and reduced-motion previews remain manual", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const path of [
      "/claude-motion-graphics",
      "/blog/claude-motion-graphics",
      "/docs/motion-studio",
    ]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
        ),
      ).toBe(false);
      const videos = await page.locator("video").all();
      for (const video of videos) await expect(video).toHaveAttribute("controls", "");
    }
    await page.goto("/blog/claude-motion-graphics");
    await expect(page.getByRole("button", { name: "Try this prompt in Vidrial" })).toHaveCount(5);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/prompts");
    await expect(page.getByRole("status", { name: "Motion results" })).toHaveAttribute(
      "data-hydrated",
      "true",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      ),
    ).toBe(false);
  });

  test("discovery indexes only public motion paths", async ({ request }) => {
    const response = await request.get("/sitemap-motion.xml");
    expect(response.ok()).toBe(true);
    const xml = await response.text();
    expect(xml).toContain("/prompts/words-with-weight");
    expect(xml).not.toContain("/app/");
    expect(xml).not.toContain("draft=");
  });
});
