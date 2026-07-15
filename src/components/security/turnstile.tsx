import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type TurnstileApi = {
  remove: (widgetId: string) => void;
  render: (
    container: HTMLElement,
    options: {
      action: string;
      appearance: "always" | "execute" | "interaction-only";
      callback: (token: string) => void;
      "error-callback": () => void;
      "expired-callback": () => void;
      sitekey: string;
      size: "flexible";
      theme: "light";
    },
  ) => string;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<TurnstileApi> | undefined;

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-vidrial-turnstile]");
    const script = existing ?? document.createElement("script");
    const onLoad = () => {
      if (window.turnstile) resolve(window.turnstile);
      else {
        scriptPromise = undefined;
        script.remove();
        reject(new Error("Turnstile did not load."));
      }
    };
    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener(
      "error",
      () => {
        scriptPromise = undefined;
        script.remove();
        reject(new Error("Turnstile could not load."));
      },
      { once: true },
    );
    if (!existing) {
      script.async = true;
      script.defer = true;
      script.dataset.vidrialTurnstile = "true";
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      document.head.append(script);
    }
  });
  return scriptPromise;
}

export function TurnstileWidget({
  action,
  appearance = "interaction-only",
  onToken,
  resetKey,
  siteKey,
}: {
  action: "signup";
  appearance?: "always" | "interaction-only";
  onToken: (token: string | null) => void;
  resetKey: number;
  siteKey: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let api: TurnstileApi | undefined;
    let widgetId: string | undefined;
    onToken(null);
    setError(null);

    void loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !container.current) return;
        api = turnstile;
        widgetId = turnstile.render(container.current, {
          action,
          appearance,
          callback: (token) => {
            setError(null);
            onToken(token);
          },
          "error-callback": () => {
            onToken(null);
            setError("Security verification could not complete. Please retry.");
          },
          "expired-callback": () => {
            onToken(null);
            setError("Security verification expired. Complete it again.");
          },
          sitekey: siteKey,
          size: "flexible",
          theme: "light",
        });
      })
      .catch(() => {
        onToken(null);
        setError("Security verification could not load. Check your connection and retry.");
      });

    return () => {
      cancelled = true;
      if (api && widgetId) api.remove(widgetId);
    };
  }, [action, appearance, loadAttempt, onToken, resetKey, siteKey]);

  return (
    <div className="mt-3 rounded-xl border border-line bg-surface-page p-3">
      <p className="mb-2 text-xs font-medium text-ink-soft">Security verification</p>
      <div
        ref={container}
        aria-label="Security verification"
        className={appearance === "always" ? "min-h-[65px]" : undefined}
      />
      {error && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2" role="alert">
          <p className="text-xs text-danger">{error}</p>
          <Button
            type="button"
            variant="link"
            size="sm"
            className="min-h-8 px-1 text-xs"
            onClick={() => setLoadAttempt((value) => value + 1)}
          >
            Retry verification
          </Button>
        </div>
      )}
    </div>
  );
}
