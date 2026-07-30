import { LoaderCircle, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type TurnstileApi = {
  remove: (widgetId: string) => void;
  reset: (widgetId: string) => void;
  render: (
    container: HTMLElement,
    options: {
      action: string;
      appearance: "always" | "execute" | "interaction-only";
      "after-interactive-callback": () => void;
      "before-interactive-callback": () => void;
      callback: (token: string) => void;
      "error-callback": (code?: string) => void;
      "expired-callback": () => void;
      "refresh-expired": "auto";
      "refresh-timeout": "auto";
      retry: "auto";
      "retry-interval": number;
      sitekey: string;
      size: "flexible";
      theme: "light";
      "timeout-callback": () => void;
      "unsupported-callback": () => void;
    },
  ) => string;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<TurnstileApi> | undefined;

export function classifyTurnstileClientError(code?: string) {
  if (code === "110200")
    return {
      message: "Security verification is not enabled for this website.",
      retryable: false,
    };
  if (code === "110620" || code === "110600")
    return {
      message: "Security verification timed out. Try again.",
      retryable: true,
    };
  if (
    code?.startsWith("200") ||
    code?.startsWith("300") ||
    code?.startsWith("600")
  )
    return {
      message: "Security verification was interrupted. Trying again…",
      retryable: true,
    };
  return {
    message: "Security verification could not complete. Please retry.",
    retryable: true,
  };
}

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-vidrial-turnstile]");
    const script = existing ?? document.createElement("script");
    const startedAt = Date.now();
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      callback();
    };
    const checkReady = () => {
      if (window.turnstile) {
        finish(() => resolve(window.turnstile as TurnstileApi));
        return;
      }
      if (Date.now() - startedAt >= 10_000) {
        finish(() => reject(new Error("Turnstile did not load.")));
        return;
      }
      window.setTimeout(checkReady, 50);
    };
    script.addEventListener(
      "error",
      () => {
        finish(() => reject(new Error("Turnstile could not load.")));
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
    checkReady();
  }).catch((error) => {
    scriptPromise = undefined;
    document.querySelector<HTMLScriptElement>("script[data-vidrial-turnstile]")?.remove();
    throw error;
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
  action: "login" | "signup";
  appearance?: "always" | "interaction-only";
  onToken: (token: string | null) => void;
  resetKey: number;
  siteKey: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [interactive, setInteractive] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let api: TurnstileApi | undefined;
    let widgetId: string | undefined;
    onToken(null);
    setError(null);
    setInteractive(false);
    setVerified(false);
    void loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !container.current) return;
        api = turnstile;
        widgetId = turnstile.render(container.current, {
          action,
          appearance,
          "after-interactive-callback": () => setInteractive(false),
          "before-interactive-callback": () => setInteractive(true),
          callback: (token) => {
            setError(null);
            setInteractive(false);
            setVerified(true);
            onToken(token);
          },
          "error-callback": (code) => {
            const failure = classifyTurnstileClientError(code);
            onToken(null);
            setVerified(false);
            setError(failure.message);
          },
          "expired-callback": () => {
            onToken(null);
            setVerified(false);
            setError("Security verification expired. Refreshing automatically...");
          },
          "refresh-expired": "auto",
          "refresh-timeout": "auto",
          retry: "auto",
          "retry-interval": 8_000,
          sitekey: siteKey,
          size: "flexible",
          theme: "light",
          "timeout-callback": () => {
            onToken(null);
            setVerified(false);
            setError("Security verification timed out. Refreshing automatically...");
          },
          "unsupported-callback": () => {
            onToken(null);
            setVerified(false);
            setError("This browser cannot run the security check. Update it or try another browser.");
          },
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

  const showChallenge = appearance === "always" || interactive;

  return (
    <div
      className={
        showChallenge || error
          ? "mt-3 min-w-0 rounded-xl border border-line bg-surface-page p-3"
          : "mt-3 min-h-5"
      }
      data-testid="turnstile-verification"
    >
      {showChallenge ? (
        <p className="mb-2 text-xs font-medium text-ink-soft">Security verification</p>
      ) : null}
      <div
        ref={container}
        aria-label="Security verification"
        className="min-w-0 max-w-full overflow-hidden"
      />
      {!showChallenge && !error ? (
        <p
          className="flex items-center gap-1.5 text-xs text-ink-mute"
          role="status"
          aria-live="polite"
        >
          {verified ? (
            <ShieldCheck className="h-3.5 w-3.5 text-success" aria-hidden />
          ) : (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden />
          )}
          {verified ? "Browser security checked" : "Checking browser security..."}
        </p>
      ) : null}
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
