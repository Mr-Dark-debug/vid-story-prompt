import { expect, test } from "@playwright/test";

const publishedSlug = "long-form-to-short-form-video-workflow";
const publishedTitle = "The Complete Long-Form to Short-Form Video Workflow";

test.describe("public blog", () => {
  test("renders a crawlable index with search and category links", async ({ page }) => {
    await page.goto("/blog");

    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Better clips start with better decisions",
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://vidrial.vercel.app/blog",
    );
    await expect(page.getByRole("link", { name: publishedTitle }).first()).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Blog categories" })).toBeVisible();
    await expect(page.getByTestId("blog-index")).toHaveAttribute("data-hydrated", "true", {
      timeout: 15_000,
    });

    const search = page.getByRole("searchbox", { name: "Search articles" });
    await search.fill("beginner");
    await expect(page.getByText("1 article", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("link", {
        name: "AI Video Editing for Beginners: From Raw Footage to Published Clips",
        exact: true,
      }),
    ).toBeVisible();
  });

  test("renders article metadata, structured data, reading tools, and internal navigation", async ({
    page,
  }) => {
    await page.goto(`/blog/${publishedSlug}`);

    await expect(page.getByRole("heading", { level: 1, name: publishedTitle })).toBeVisible();
    await expect(page.getByText("AI Summary", { exact: true })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Table of contents" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sources and further reading" })).toBeVisible();
    await expect(page.getByText("Was this helpful?", { exact: true })).toBeVisible();
    await expect(page.getByRole("group", { name: "Share this article" })).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      `https://vidrial.vercel.app/blog/${publishedSlug}`,
    );

    const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(jsonLd).toHaveLength(2);
    expect(jsonLd.some((value) => value.includes('"@type":"BlogPosting"'))).toBe(true);
    expect(jsonLd.some((value) => value.includes('"@type":"BreadcrumbList"'))).toBe(true);
  });

  test("returns a real 404 for unknown and malformed slugs", async ({ page }) => {
    const unknown = await page.goto("/blog/does-not-exist");
    expect(unknown?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();

    const malformed = await page.goto("/blog/NOT_VALID");
    expect(malformed?.status()).toBe(404);
  });

  test("serves discovery endpoints without drafts or private app routes", async ({ request }) => {
    const [index, blog, rss, robots] = await Promise.all([
      request.get("/sitemap.xml"),
      request.get("/sitemap-blog.xml"),
      request.get("/rss.xml"),
      request.get("/robots.txt"),
    ]);

    expect(index.ok()).toBe(true);
    expect(await index.text()).toContain("https://vidrial.vercel.app/sitemap-blog.xml");

    const blogXml = await blog.text();
    expect(blog.ok()).toBe(true);
    expect(blogXml).toContain(`https://vidrial.vercel.app/blog/${publishedSlug}`);
    expect(blogXml).not.toContain("turn-a-podcast-into-short-video-clips");
    expect(blogXml).not.toContain("/app/");

    expect(rss.ok()).toBe(true);
    expect(await rss.text()).toContain(publishedTitle);
    expect(robots.ok()).toBe(true);
    expect(await robots.text()).toContain("Sitemap: https://vidrial.vercel.app/sitemap.xml");
  });

  test("keeps the article usable at a narrow mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`/blog/${publishedSlug}`);

    await expect(page.getByRole("heading", { level: 1, name: publishedTitle })).toBeVisible();
    await expect(page.getByText("Table of contents", { exact: true })).toBeVisible();
    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(horizontalOverflow).toBe(false);
  });
});
