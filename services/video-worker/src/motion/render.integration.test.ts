// @vitest-environment node
import { mkdtemp, rm, readFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { renderScene } from "./frame-loop.js";
import { openScene, bounded } from "./browser.js";
const require = createRequire(import.meta.url);
const executablePath = process.env.MOTION_TEST_CHROMIUM_PATH;
const ffmpegPath: string = require("ffmpeg-static");
const ffprobePath: string = require("ffprobe-static").path;
const spec = {
  width: 320,
  height: 180,
  fps: 24 as const,
  durationSeconds: 1,
  aspect: "16:9" as const,
};
const authoredScene = `<html><body><canvas id="c" width="320" height="180"></canvas><script>window.DURATION=1;const g=document.getElementById('c').getContext('2d');window.seek=async function(t){g.fillStyle='#1d1d1b';g.fillRect(0,0,320,180);g.fillStyle='#ef8668';g.fillRect(40+80*t,40,100,80);};window.renderAudio=async function(){const c=new OfflineAudioContext(1,48000,48000);const o=c.createOscillator();const gain=c.createGain();gain.gain.value=0.05;o.connect(gain);gain.connect(c.destination);o.start(0);o.stop(1);return c.startRendering();};</script></body></html>`;
describe.skipIf(!executablePath)(
  "trusted authored scene Chromium/FFmpeg integration (not Docker proof)",
  () => {
    it("renders and verifies real H264 MP4 with AAC and a deterministic seek", async () => {
      const directory = await mkdtemp(join(tmpdir(), "vidrial-motion-test-"));
      try {
        const result = await renderScene(authoredScene, spec, directory, {
          executablePath,
          ffmpegPath,
          ffprobePath,
          watermark: true,
        });
        expect(result.manifest.hasAudio).toBe(true);
        expect(result.manifest.frameCount).toBe(24);
        expect((await readFile(result.output)).length).toBeGreaterThan(1000);
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
      await expect(access(directory)).rejects.toThrow();
    }, 30_000);
    it("blocks fetch, XHR, WebSocket, import, beacon, popups, forms, filesystem and parent access", async () => {
      // Intentionally bypass static lint to test browser isolation itself against authored attack fixtures.
      const attempts = [
        "await fetch('https://example.com')",
        "await new Promise((resolve,reject)=>{const x=new XMLHttpRequest();x.open('GET','https://example.com');x.onload=resolve;x.onerror=reject;x.send();})",
        "new WebSocket('wss://example.com')",
        "await import('https://example.com/a.js')",
        "if(navigator.sendBeacon('https://example.com','x'))throw new Error('unexpected_delivery')",
        "if(window.open('https://example.com'))throw new Error('unexpected_popup')",
        "await fetch('file:///etc/passwd')",
        "parent.document.body.innerHTML='escaped'",
        "new Function('return 1')()",
      ];
      const attackScene = authoredScene.replace(
        "</script>",
        "try{new Function('return 1')();window.evalBlocked=false}catch{window.evalBlocked=true}</script>",
      );
      const scene = await openScene(attackScene, spec, { executablePath });
      try {
        for (const code of attempts) {
          const result = await bounded(
            scene.frame.evaluate(async (attack) => {
              // CSP forbids eval; use direct declared attack branches below instead.
              const blocked = async (run: () => unknown) => {
                try {
                  await run();
                  return false;
                } catch {
                  return true;
                }
              };
              if (attack.startsWith("await fetch('https"))
                return blocked(() => fetch("https://example.com"));
              if (attack.startsWith("await new Promise"))
                return blocked(
                  () =>
                    new Promise((resolve, reject) => {
                      const x = new XMLHttpRequest();
                      x.open("GET", "https://example.com");
                      x.onload = resolve;
                      x.onerror = reject;
                      x.send();
                    }),
                );
              if (attack.startsWith("new WebSocket"))
                return blocked(() => new WebSocket("wss://example.com"));
              if (attack.startsWith("await import")) {
                const url = "https://example.com/a.js";
                return blocked(() => import(/* @vite-ignore */ url));
              }
              if (attack.startsWith("if(navigator"))
                return new Promise<boolean>((resolve) => {
                  const listener = (event: SecurityPolicyViolationEvent) => {
                    if (event.violatedDirective === "connect-src") {
                      document.removeEventListener("securitypolicyviolation", listener);
                      resolve(true);
                    }
                  };
                  document.addEventListener("securitypolicyviolation", listener);
                  if (!navigator.sendBeacon("https://example.com", "x")) {
                    document.removeEventListener("securitypolicyviolation", listener);
                    resolve(true);
                  }
                });
              if (attack.startsWith("if(window.open"))
                return window.open("https://example.com") === null;
              if (attack.startsWith("await fetch('file"))
                return blocked(() => fetch("file:///etc/passwd"));
              if (attack.startsWith("parent"))
                return blocked(() => {
                  parent.document.body.innerHTML = "escaped";
                });
              // CDP evaluation bypasses CSP; inspect the attempt executed by the document itself.
              return (window as unknown as { evalBlocked: boolean }).evalBlocked;
            }, code),
            3000,
            scene.browser,
          );
          expect(result, code).toBe(true);
        }
        const formBlocked = await bounded(
          scene.frame.evaluate(() => {
            const f = document.createElement("form");
            f.method = "POST";
            f.action = "https://example.com";
            document.body.append(f);
            try {
              f.submit();
              return false;
            } catch {
              return location.href === "about:srcdoc";
            }
          }),
          3000,
          scene.browser,
        );
        expect(formBlocked).toBe(true);
        expect(scene.page.context().pages()).toHaveLength(1);
      } finally {
        await scene.close();
      }
    }, 30_000);
    it("closes Chromium on per-frame timeout", async () => {
      const scene = await openScene(authoredScene, spec, { executablePath });
      try {
        await expect(
          bounded(
            scene.frame.evaluate(() => new Promise(() => undefined)),
            30,
            scene.browser,
          ),
        ).rejects.toThrow("motion_frame_timeout");
        expect(scene.browser.isConnected()).toBe(false);
      } finally {
        await scene.close().catch(() => undefined);
      }
    });
    it("aborts mid-render and releases Chromium", async () => {
      const directory = await mkdtemp(join(tmpdir(), "vidrial-motion-cancel-"));
      const controller = new AbortController();
      try {
        await expect(
          renderScene(authoredScene, spec, directory, {
            executablePath,
            ffmpegPath,
            ffprobePath,
            watermark: false,
            signal: controller.signal,
            onProgress: async () => controller.abort(),
          }),
        ).rejects.toThrow();
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
      await expect(access(directory)).rejects.toThrow();
    }, 30_000);
  },
);
