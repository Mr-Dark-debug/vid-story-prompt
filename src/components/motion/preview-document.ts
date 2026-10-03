import { MOTION_CSP } from "@/domain/motion/contract";
import { lintMotionHtml } from "@/domain/motion/lint";
import { MOTION_PREVIEW_FONT_CSS } from "./preview-fonts";

/** The CSP and bridge are installed before any submitted markup is parsed. */
export function createMotionPreviewDocument(source: string, token: string, parentOrigin: string) {
  if (!lintMotionHtml(source).ok)
    throw new Error("The scene must pass the motion linter before preview.");
  const encode = (value: string) => JSON.stringify(value).replaceAll("<", "\\u003c");
  const bridge = `(() => {
    const token = ${encode(token)}, origin = ${encode(parentOrigin)};
    const send = (type, extra = {}) => parent.postMessage({ motionPreview: true, token, type, ...extra }, origin);
    let seeking = false, pendingTime = null;
    addEventListener('message', async (event) => {
      const message = event.data;
      if (event.source !== parent || event.origin !== origin || !message || message.token !== token || message.type !== 'seek' || !Number.isFinite(message.time)) return;
      pendingTime = message.time;
      if (seeking) return;
      seeking = true;
      try {
        if (typeof window.seek !== 'function') throw new Error('Missing seek');
        while (pendingTime !== null) {
          const time = pendingTime; pendingTime = null;
          await window.seek(Math.max(0, Math.min(Number(window.DURATION), time)));
          send('frame', {time});
        }
      } catch { send('error'); } finally { seeking = false; }
    });
    addEventListener('DOMContentLoaded', async () => {
      try {
        await Promise.all(['Manrope','JetBrains Mono','EB Garamond'].map(family => document.fonts.load('400 32px "'+family+'"')));
        await document.fonts.ready;
        if (!Number.isFinite(window.DURATION) || window.DURATION <= 0 || typeof window.seek !== 'function') throw new Error('Invalid contract');
        await window.seek(0);
        send('ready');
      } catch { send('error'); }
    }, {once: true});
  })();`;
  // No same-origin permission is granted to this document by the iframe.
  return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${MOTION_CSP}"><meta name="referrer" content="no-referrer"><style>html,body{margin:0;overflow:hidden}${MOTION_PREVIEW_FONT_CSS}</style><script>${bridge}</script></head><body>${source}</body></html>`;
}

export function isMotionPreviewMessage(event: MessageEvent, source: Window | null, token: string) {
  return Boolean(
    source &&
    event.source === source &&
    event.origin === "null" &&
    event.data?.motionPreview === true &&
    event.data?.token === token &&
    ["ready", "frame", "error"].includes(event.data?.type),
  );
}
