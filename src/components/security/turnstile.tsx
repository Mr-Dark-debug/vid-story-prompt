import { useEffect, useRef, useState } from "react";

type TurnstileApi = {
  remove: (widgetId: string) => void;
  render: (
    container: HTMLElement,
    options: {
      action: string;
      appearance: "interaction-only";
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
    const onLoad = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile did not load."));
    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", () => reject(new Error("Turnstile could not load.")), {
      once: true,
    });
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
  onToken,
  resetKey,
  siteKey,
}: {
  onToken: (token: string | null) => void;
  resetKey: number;
  siteKey: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

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
          action: "youtube_metadata",
          appearance: "interaction-only",
          callback: (token) => onToken(token),
          "error-callback": () => {
            onToken(null);
            setError("The abuse-protection check could not complete. Retry it.");
          },
          "expired-callback": () => onToken(null),
          sitekey: siteKey,
          size: "flexible",
          theme: "light",
        });
      })
      .catch(() => setError("The abuse-protection check could not load."));

    return () => {
      cancelled = true;
      if (api && widgetId) api.remove(widgetId);
    };
  }, [onToken, resetKey, siteKey]);

  return (
    <div className="mt-3">
      <div ref={container} aria-label="Abuse-protection verification" />
      {error && (
        <p className="mt-2 text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
