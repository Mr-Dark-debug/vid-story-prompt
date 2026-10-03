import { expect, test } from "@playwright/test";
test.use({ baseURL: "http://127.0.0.1:4192" });
test("labelled signed-in service fixture generates, isolates preview, versions and downloads", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Project title").fill("An original story");
  await page
    .getByLabel("Your motion brief")
    .fill("Tell an original story using the exact text 'Small steps'.");
  await page.getByRole("button", { name: "Make one from scratch" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("An original story");
  await page.getByRole("button", { name: "Load preview" }).click();
  const iframe = page.locator("iframe");
  await expect(iframe).toHaveAttribute("sandbox", "allow-scripts");
  await expect(page.getByRole("slider", { name: "Preview time" })).toBeEnabled();
  expect(await iframe.evaluate((element) => (element as HTMLIFrameElement).srcdoc)).toContain(
    "connect-src 'none'",
  );
  await page.getByRole("button", { name: "Export MP4", exact: true }).click();
  await expect(page.getByRole("button", { name: "Download MP4" })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download MP4" }).click();
  expect((await download).suggestedFilename()).toMatch(/\.mp4$/);
  await page.setViewportSize({ width: 360, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    ),
  ).toBe(false);
  await page.getByRole("tab", { name: "Scene code" }).click();
  await page
    .getByLabel("Single-file HTML scene")
    .fill("<script>fetch('https://example.com')</script>");
  await expect(
    page.getByRole("button", { name: "Save a new version", exact: true }),
  ).toBeDisabled();
});
