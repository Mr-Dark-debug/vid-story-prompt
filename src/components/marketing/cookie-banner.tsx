import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

const KEY = "vidrial.consent.v1";

type Consent = { necessary: true; analytics: boolean; marketing: boolean };

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(KEY)) setVisible(true);
  }, []);

  function save(c: Consent) {
    localStorage.setItem(KEY, JSON.stringify({ ...c, at: Date.now() }));
    setVisible(false);
  }

  if (!visible) return null;
  return (
    <div className="fixed inset-x-3 bottom-3 z-50 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:max-w-md">
      <div className="rounded-2xl border border-line bg-surface-panel p-4 shadow-lg shadow-black/5">
        <div className="text-sm font-medium text-ink">A note about cookies</div>
        <p className="mt-1 text-sm text-ink-soft">
          We use necessary cookies to run the site. Optional analytics help us understand what to improve.
          You can decline as easily as accept.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => save({ necessary: true, analytics: false, marketing: false })}
            className="rounded-md border border-line px-3 py-1.5 text-sm text-ink hover:bg-surface-sunken"
          >
            Only necessary
          </button>
          <button
            onClick={() => save({ necessary: true, analytics: true, marketing: false })}
            className="rounded-md bg-ink px-3 py-1.5 text-sm text-surface-page hover:opacity-90"
          >
            Accept optional
          </button>
          <Link
            to="/cookies"
            onClick={() => save({ necessary: true, analytics: false, marketing: false })}
            className="ml-auto self-center text-xs text-ink-mute underline underline-offset-2"
          >
            Cookie settings
          </Link>
        </div>
      </div>
    </div>
  );
}