import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { lintMotionHtml } from "@/domain/motion/lint";
import type { MotionRenderSpec } from "@/domain/motion/types";
import { createMotionPreviewDocument, isMotionPreviewMessage } from "./preview-document";

export function MotionPreview({ source, spec }: { source: string; spec: MotionRenderSpec }) {
  const lint = useMemo(
    () => lintMotionHtml(source, spec.durationSeconds),
    [source, spec.durationSeconds],
  );
  const frame = useRef<HTMLIFrameElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const [document, setDocument] = useState<{ html: string; token: string } | null>(null);
  const [scale, setScale] = useState(1);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [enabledSource, setEnabledSource] = useState<string | null>(null);
  const awaiting = useRef(false);
  const frameTimeout = useRef<number | null>(null);

  useEffect(() => {
    setPlaying(false);
    setReady(false);
    setTime(0);
    setError(false);
    awaiting.current = false;
    if (!lint.ok || enabledSource !== source) {
      setDocument(null);
      return;
    }
    const token = crypto.randomUUID();
    setDocument({
      html: createMotionPreviewDocument(source, token, window.location.origin),
      token,
    });
  }, [source, lint.ok, enabledSource]);

  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setReducedMotion(query.matches);
      if (query.matches) setPlaying(false);
    };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setScale(entry.contentRect.width / spec.width),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [spec.width]);

  useEffect(() => {
    if (!document) return;
    const receive = (event: MessageEvent) => {
      if (!isMotionPreviewMessage(event, frame.current?.contentWindow ?? null, document.token))
        return;
      if (event.data.type === "ready") setReady(true);
      if (event.data.type === "error") {
        setError(true);
        setPlaying(false);
      }
      awaiting.current = false;
      if (frameTimeout.current !== null) window.clearTimeout(frameTimeout.current);
    };
    window.addEventListener("message", receive);
    return () => {
      window.removeEventListener("message", receive);
      if (frameTimeout.current !== null) window.clearTimeout(frameTimeout.current);
    };
  }, [document]);

  useEffect(() => {
    if (!document || ready || error) return;
    const timer = window.setTimeout(() => {
      setError(true);
      setPlaying(false);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [document, ready, error]);

  useEffect(() => {
    if (!playing || !ready || !document || reducedMotion) return;
    let next = time;
    let last = performance.now();
    const timer = window.setInterval(() => {
      if (awaiting.current) {
        if (performance.now() - last > 3000) {
          setError(true);
          setPlaying(false);
        }
        return;
      }
      const now = performance.now();
      next = Math.min(spec.durationSeconds, next + Math.min(0.25, (now - last) / 1000));
      last = now;
      awaiting.current = true;
      frame.current?.contentWindow?.postMessage(
        { type: "seek", token: document.token, time: next },
        "*",
      );
      setTime(next);
      if (next >= spec.durationSeconds) setPlaying(false);
    }, 1000 / spec.fps);
    return () => window.clearInterval(timer);
    // The playhead advances within this effect, without restarting the timer for each frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, ready, document, reducedMotion, spec.durationSeconds, spec.fps]);

  if (!lint.ok)
    return (
      <div
        role="alert"
        className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger"
      >
        Preview blocked. {lint.errors.map((item) => item.message).join(" ")}
      </div>
    );
  const seek = (next: number) => {
    setPlaying(false);
    setTime(next);
    awaiting.current = true;
    if (frameTimeout.current !== null) window.clearTimeout(frameTimeout.current);
    frameTimeout.current = window.setTimeout(() => {
      setError(true);
      setPlaying(false);
    }, 3000);
    frame.current?.contentWindow?.postMessage(
      { type: "seek", token: document?.token, time: next },
      "*",
    );
  };
  return (
    <section aria-label="Animation preview" className="min-w-0 space-y-3">
      <div
        ref={container}
        className="relative overflow-hidden rounded-xl border border-line bg-surface-sunken"
        style={{ aspectRatio: `${spec.width}/${spec.height}` }}
      >
        {document && !error && (
          <iframe
            ref={frame}
            title="Isolated motion scene"
            sandbox="allow-scripts"
            referrerPolicy="no-referrer"
            srcDoc={document.html}
            className="absolute left-0 top-0 border-0"
            style={{
              width: spec.width,
              height: spec.height,
              transform: `scale(${scale})`,
              transformOrigin: "0 0",
            }}
          />
        )}
        {!document && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
            <p className="max-w-sm text-sm text-ink-soft">
              Run this linted scene in an isolated preview. Complex scenes may use your device’s
              CPU.
            </p>
            <Button onClick={() => setEnabledSource(source)}>Load preview</Button>
          </div>
        )}
        {error && (
          <p
            role="alert"
            className="absolute inset-0 grid place-items-center p-4 text-center text-sm text-danger"
          >
            This scene could not be previewed safely. Review its code or regenerate it.
          </p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <Button
          size="icon"
          variant="outline"
          disabled={!ready || error || reducedMotion}
          aria-label={playing ? "Pause preview" : "Play preview"}
          onClick={() => {
            if (time >= spec.durationSeconds) seek(0);
            setPlaying(!playing);
          }}
        >
          {playing ? <Pause aria-hidden /> : <Play aria-hidden />}
        </Button>
        <input
          aria-label="Preview time"
          type="range"
          min={0}
          max={spec.durationSeconds}
          step={1 / spec.fps}
          value={time}
          disabled={!ready || error}
          onChange={(event) => seek(Number(event.target.value))}
          className="min-w-0 flex-1 accent-ember"
        />
        <output className="shrink-0 font-mono text-xs text-ink-soft">
          {time.toFixed(1)} / {spec.durationSeconds}s
        </output>
      </div>
      <p className="text-xs text-ink-mute">
        {reducedMotion
          ? "Reduced motion is enabled. Use the time slider to inspect frames."
          : "Preview is isolated from your account. Export quality is checked separately by the worker."}
      </p>
    </section>
  );
}
