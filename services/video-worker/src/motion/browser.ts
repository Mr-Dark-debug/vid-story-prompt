import { chromium, type Browser, type Frame, type Page } from "playwright-core";
import { HARD_LIMITS, type RenderSpec } from "./limits.js";
import { MOTION_CSP } from "./generated/contract.js";

export const RENDER_CSP = MOTION_CSP;

/** Pure renderer: no credentials, no filesystem URLs, and a fresh opaque iframe. */
export async function openScene(
  source: string,
  spec: RenderSpec,
  options: { executablePath?: string; signal?: AbortSignal; bundledFontCss?: string } = {},
) {
  options.signal?.throwIfAborted();
  const browser = await chromium.launch({
    executablePath: options.executablePath,
    headless: true,
    chromiumSandbox: true,
    timeout: 20_000,
    env: {
      PATH: process.env.PATH ?? "/usr/bin:/bin",
      HOME: process.env.TMPDIR ?? "/tmp",
      TMPDIR: process.env.TMPDIR ?? "/tmp",
      LANG: "C.UTF-8",
      ...(process.platform === "win32"
        ? {
            SystemRoot: process.env.SystemRoot ?? "C:\\Windows",
            TEMP: process.env.TEMP ?? "C:\\Windows\\Temp",
          }
        : {}),
    },
    args: [
      "--disable-dev-shm-usage",
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-sync",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--disable-features=Translate,MediaRouter,OptimizationHints",
      "--js-flags=--max-old-space-size=256",
    ],
  });
  const kill = () => void browser.close().catch(() => undefined);
  options.signal?.addEventListener("abort", kill, { once: true });
  try {
    const context = await browser.newContext({
      viewport: { width: spec.width, height: spec.height },
      deviceScaleFactor: 1,
      serviceWorkers: "block",
      acceptDownloads: false,
      reducedMotion: "reduce",
      permissions: [],
      colorScheme: "dark",
    });
    await context.addInitScript(() => {
      const denied = function () {
        throw new Error("motion_api_blocked");
      };
      for (const name of [
        "fetch",
        "XMLHttpRequest",
        "WebSocket",
        "EventSource",
        "Worker",
        "SharedWorker",
        "RTCPeerConnection",
        "setTimeout",
        "setInterval",
        "requestAnimationFrame",
        "requestIdleCallback",
      ])
        Object.defineProperty(window, name, {
          value: denied,
          writable: false,
          configurable: false,
        });
      Object.defineProperty(navigator, "sendBeacon", {
        value: () => false,
        writable: false,
        configurable: false,
      });
      Object.defineProperty(window, "open", {
        value: () => null,
        writable: false,
        configurable: false,
      });
      for (const name of ["submit", "requestSubmit"])
        Object.defineProperty(HTMLFormElement.prototype, name, {
          value: denied,
          writable: false,
          configurable: false,
        });
    });
    await context.route("**/*", (route) =>
      /^(data:|blob:)/.test(route.request().url())
        ? route.continue()
        : route.abort("blockedbyclient"),
    );
    await context.routeWebSocket(/.*/, (socket) => socket.close());
    context.on("page", (popup) => {
      if (context.pages().length > 1) void popup.close();
    });
    const page = await context.newPage();
    page.on("dialog", (dialog) => void dialog.dismiss());
    page.setDefaultTimeout(HARD_LIMITS.frameTimeoutMs);
    await page.setContent(
      '<html><head><style>html,body{margin:0;overflow:hidden}iframe{border:0;display:block;width:100vw;height:100vh}</style></head><body><iframe name="motion" sandbox="allow-scripts" referrerpolicy="no-referrer"></iframe></body></html>',
    );
    const html = `<!doctype html><meta http-equiv="Content-Security-Policy" content="${RENDER_CSP}"><style>html,body{margin:0;overflow:hidden}${options.bundledFontCss ?? ""}</style>${source}`;
    await page.locator("iframe").evaluate((element, content) => {
      (element as HTMLIFrameElement).srcdoc = content;
    }, html);
    const frame = page.frame({ name: "motion" });
    if (!frame) throw new Error("motion_browser_frame_missing");
    await bounded(
      frame.waitForFunction(
        () => typeof (window as unknown as { seek?: unknown }).seek === "function",
      ),
      HARD_LIMITS.frameTimeoutMs,
      browser,
      options.signal,
    );
    await bounded(
      frame.evaluate(async () => {
        // Canvas does not initiate a font load until use; explicitly warm bundled families.
        await Promise.all(
          ["Manrope", "JetBrains Mono", "EB Garamond"].map((family) =>
            document.fonts.load(`400 32px "${family}"`),
          ),
        );
        await document.fonts.ready;
      }),
      HARD_LIMITS.frameTimeoutMs,
      browser,
      options.signal,
    );
    const duration = await frame.evaluate(
      () => (window as unknown as { DURATION: unknown }).DURATION,
    );
    if (
      typeof duration !== "number" ||
      !Number.isFinite(duration) ||
      Math.abs(duration - spec.durationSeconds) > 1 / spec.fps
    )
      throw new Error("motion_duration_mismatch");
    // Initialize the headless compositor before the first sought frame; a newly
    // navigated srcdoc surface can otherwise return its pre-paint background.
    await bounded(
      page.screenshot({ type: "png", timeout: HARD_LIMITS.frameTimeoutMs }),
      HARD_LIMITS.frameTimeoutMs,
      browser,
      options.signal,
    );
    return {
      browser,
      page,
      frame,
      close: async () => {
        options.signal?.removeEventListener("abort", kill);
        await browser.close();
      },
    };
  } catch (error) {
    options.signal?.removeEventListener("abort", kill);
    await browser.close().catch(() => undefined);
    throw error;
  }
}

export async function bounded<T>(
  operation: Promise<T>,
  timeoutMs: number,
  browser: Browser,
  signal?: AbortSignal,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort: (() => void) | undefined;
  let stopCode: string | undefined;
  try {
    signal?.throwIfAborted();
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        const fail = (code: string) => {
          stopCode = code;
          reject(new Error(code));
          void browser.close().catch(() => undefined);
        };
        timer = setTimeout(() => fail("motion_frame_timeout"), timeoutMs);
        abort = () => fail("motion_cancelled");
        signal?.addEventListener("abort", abort, { once: true });
      }),
    ]);
  } catch (error) {
    if (stopCode) throw new Error(stopCode);
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
    if (abort) signal?.removeEventListener("abort", abort);
    if (stopCode) await browser.close().catch(() => undefined);
  }
}

export async function seekFrame(
  scene: { frame: Frame; page: Page; browser: Browser },
  t: number,
  signal?: AbortSignal,
) {
  await bounded(
    scene.frame.evaluate(async (time) => {
      await (window as unknown as { seek: (t: number) => Promise<void> }).seek(time);
    }, t),
    HARD_LIMITS.frameTimeoutMs,
    scene.browser,
    signal,
  );
  return bounded(
    scene.page.screenshot({
      type: "png",
      animations: "disabled",
      timeout: HARD_LIMITS.frameTimeoutMs,
    }),
    HARD_LIMITS.frameTimeoutMs,
    scene.browser,
    signal,
  );
}
