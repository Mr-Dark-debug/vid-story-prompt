import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

// These tests drive the real AI components against FAKE server functions and a FAKE provider (see
// e2e/ai.vite.config.ts). They verify browser behaviour only; real providers, real keys,
// Supabase persistence and the production route handler are not exercised here.
const FIXTURE = "http://127.0.0.1:4175";
const GOOD_KEY = "sk-ant-api03-PLAYWRIGHTFAKEKEY00001234";

test.beforeEach(async ({ request }) => {
  await request.post(`${FIXTURE}/__fixture/reset`);
});

for (const width of [360, 1280]) {
  test(`add a provider key: validation, masking and no key leakage at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${FIXTURE}/#providers`);
    await expect(page.getByText("Not connected")).toBeVisible();

    await page.getByRole("button", { name: "Connect Anthropic key" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("API key")).toHaveAttribute("type", "password");
    const save = dialog.getByRole("button", { name: "Validate and save" });

    // The disclosure must be accepted before a key can be saved.
    await dialog.getByLabel("API key").fill("sk-ant-api03-rejected-by-provider");
    await expect(save).toBeDisabled();
    await dialog.getByRole("checkbox").check();
    await save.click();
    await expect(dialog.getByRole("alert")).toContainText("rejected this key");
    await expect(dialog.getByLabel("API key")).toHaveValue("");

    await dialog.getByLabel("API key").fill(GOOD_KEY);
    await save.click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("••••1234")).toBeVisible();
    await expect(page.getByText("Active", { exact: true })).toBeVisible();

    // The full key must not appear anywhere in the DOM once saved.
    expect(await page.content()).not.toContain(GOOD_KEY);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await mkdir("output/playwright", { recursive: true });
    await page.screenshot({ path: `output/playwright/ai-providers-${width}.png`, fullPage: true });
  });
}

test("chat: send, stream, stop and regenerate", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${FIXTURE}/#chat`);
  await page.reload();
  const box = page.getByRole("textbox", { name: "Message" });
  await expect(page.getByText("What are you working on?")).toBeVisible();

  // A suggestion fills the box; it is never sent automatically.
  await page.getByRole("button", { name: /Title and hook ideas/ }).click();
  await expect(box).toHaveValue(/five title and opening-hook ideas/);
  await box.fill("Give me hooks");
  await box.press("Enter");

  await expect(page.getByRole("button", { name: "Stop generating" })).toBeVisible();
  await expect(page.getByText("Give me hooks")).toBeVisible();
  // The reply completes with usage and actions.
  await expect(page.getByText(/42 in · \d+ out tokens/)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/take 1/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Send message" })).toBeVisible();

  // Regenerate replaces the reply with a new take.
  await page.getByRole("button", { name: /Regenerate/ }).click();
  await expect(page.getByText(/take 2/)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/take 1/)).toHaveCount(0);

  // Stop mid-stream keeps the partial text and says so.
  await box.fill("One more");
  await box.press("Enter");
  await expect(page.getByRole("button", { name: "Stop generating" })).toBeVisible();
  await page.getByRole("button", { name: "Stop generating" }).click();
  await expect(page.getByText("Stopped.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send message" })).toBeVisible();
  expect(
    await page.evaluate(
      () => (window as unknown as { __stopCalls?: string[] }).__stopCalls?.length,
    ),
  ).toBe(1);
});

test("chat: a refused request shows the server's reason and keeps the conversation clean", async ({
  page,
}) => {
  await page.goto(`${FIXTURE}/#chat`);
  await page.reload();
  const box = page.getByRole("textbox", { name: "Message" });
  await box.fill("FORCE_BUSY please");
  await box.press("Enter");
  await expect(page.getByText("This chat is still generating a reply.").first()).toBeVisible();
  // The optimistic bubbles are removed because the turn never started.
  await expect(page.getByText("FORCE_BUSY please")).toHaveCount(0);
});

for (const width of [360, 1280]) {
  test(`model picker lists makers, context and price hints at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${FIXTURE}/#chat`);
    await page.reload();
    await page.getByRole("combobox", { name: "Model for this chat" }).click();
    // 360px opens a bottom sheet; wider screens open a popover.
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("Meta: Llama 3.3 70B Instruct")).toBeVisible();
    await expect(page.getByText("$0.1 in · $0.3 out / 1M tokens")).toBeVisible();
    await expect(page.getByText("1M context")).toBeVisible();
    await page.getByRole("combobox", { name: "Search models" }).fill("llama");
    // The composer button still names the current model; only the picker list is filtered.
    await expect(page.getByRole("dialog").getByText("Claude Opus 5")).toHaveCount(0);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    // Let the sheet/popover finish animating so the capture shows the settled layout.
    await page.waitForFunction(() =>
      document.getAnimations().every((a) => a.playState !== "running"),
    );
    await mkdir("output/playwright", { recursive: true });
    await page.screenshot({ path: `output/playwright/ai-model-picker-${width}.png` });
  });
}

test("chat layout at 360px after a reply", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(`${FIXTURE}/#chat`);
  await page.reload();
  const box = page.getByRole("textbox", { name: "Message" });
  await box.fill("Give me hooks");
  await box.press("Enter");
  await expect(page.getByText(/42 in · \d+ out tokens/)).toBeVisible({ timeout: 10_000 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await mkdir("output/playwright", { recursive: true });
  await page.screenshot({ path: "output/playwright/ai-chat-360.png" });
});
