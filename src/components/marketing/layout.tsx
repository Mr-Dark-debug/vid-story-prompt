import type { ReactNode } from "react";
import { MarketingNav } from "./nav";
import { MarketingFooter } from "./footer";
import { CookieBanner } from "./cookie-banner";

export function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <MarketingNav />
      <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
      <MarketingFooter />
      <CookieBanner />
    </div>
  );
}
