import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

for (const width of [360, 1280]) {
  test(`Exact Cut UI contract: five ranges, editing and quota at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("http://127.0.0.1:4174");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("radio", { name: "I already know my clips" }).click();
    await page.getByLabel("Paste timestamp ranges").fill("0-10, 10-20\n20-30,30-40,40-50");
    await page.getByRole("button", { name: "Add pasted ranges" }).click();
    await page.getByLabel("End for clip 1", { exact: true }).fill("12");
    await expect(page.getByText(/overlap/i).first()).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await mkdir("output/playwright", { recursive: true });
    await page.screenshot({ path: `output/playwright/exact-cut-${width}.png`, fullPage: true });
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByText("52 selected-range seconds")).toBeVisible();
    await page.getByRole("button", { name: "Create clipping job" }).click();
    const request = JSON.parse((await page.getByTestId("submitted-request").textContent()) ?? "{}");
    expect(request.settings).toMatchObject({ mode: "manual_timestamp", captionsRequested: false });
    expect(request.settings.ranges).toHaveLength(5);
    expect(request.rightsAccepted).toBe(true);
    expect(request.sourceDurationSeconds).toBe(600);
    expect(request.settings.instruction).toBeUndefined();
  });
}

test("Exact Cut UI blocks range count above the canonical free-plan limit", async ({ page }) => {
  await page.goto("http://127.0.0.1:4174");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("radio", { name: "I already know my clips" }).click();
  await page.getByLabel("Paste timestamp ranges").fill("0-1,1-2,2-3,3-4,4-5,5-6");
  await page.getByRole("button", { name: "Add pasted ranges" }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("up to 5 clips");
  await expect(page.getByTestId("submitted-request")).toHaveText("No request submitted");
});
