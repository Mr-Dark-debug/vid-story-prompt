import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Menu, X, ChevronDown } from "lucide-react";
import { Logo } from "@/components/primitives/logo";
import { brand } from "@/config/brand";
import { productMenu, useCasesMenu, resourcesMenu, type NavItem } from "@/config/nav";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MarketingAccountActions } from "./account-actions";
import { cn } from "@/lib/utils";
import { useSessionState } from "@/services/auth";

function DropTrigger({ label, items }: { label: string; items: NavItem[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-ink-soft transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {label}
        <ChevronDown className="h-3.5 w-3.5" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={8} className="min-w-[240px]">
        {items.map((item) => (
          <DropdownMenuItem key={item.to} asChild>
            <Link to={item.to} className="flex flex-col items-start gap-0.5">
              <span className="text-sm text-ink">{item.label}</span>
              {item.description && (
                <span className="text-xs text-ink-mute">{item.description}</span>
              )}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const { user, isLoading } = useSessionState();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      window.requestAnimationFrame(() => menuButton.current?.focus());
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-colors",
        scrolled
          ? "border-b border-line/70 bg-surface-page/85 backdrop-blur"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 sm:px-8">
        <div className="flex items-center gap-8">
          <Logo />
          <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
            <DropTrigger label="Product" items={productMenu} />
            <DropTrigger label="Use cases" items={useCasesMenu} />
            <Link
              to="/how-it-works"
              className="rounded-md px-2 py-1.5 text-sm text-ink-soft transition-colors hover:text-ink"
            >
              How it works
            </Link>
            <Link
              to="/pricing"
              className="rounded-md px-2 py-1.5 text-sm text-ink-soft transition-colors hover:text-ink"
            >
              Pricing
            </Link>
            <DropTrigger label="Resources" items={resourcesMenu} />
          </nav>
        </div>
        <div className="hidden items-center gap-2 lg:flex">
          <MarketingAccountActions user={user} isLoading={isLoading} />
        </div>
        <button
          ref={menuButton}
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label="Toggle menu"
          className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-line text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember lg:hidden"
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>
      {open && (
        <div className="lg:hidden">
          <div className="border-t border-line bg-surface-panel px-5 py-4 sm:px-8">
            <MobileSection label="Product" items={productMenu} onNavigate={() => setOpen(false)} />
            <MobileSection
              label="Use cases"
              items={useCasesMenu}
              onNavigate={() => setOpen(false)}
            />
            <MobileSection
              label="Resources"
              items={resourcesMenu}
              onNavigate={() => setOpen(false)}
            />
            <MarketingAccountActions
              user={user}
              isLoading={isLoading}
              mobile
              onNavigate={() => setOpen(false)}
            />
          </div>
        </div>
      )}
      <div className="border-b border-line/50 bg-ember-soft/50">
        <div className="mx-auto flex max-w-6xl items-center justify-center gap-3 px-5 py-1.5 text-[12px] text-ember-ink sm:px-8">
          <span className="hidden sm:inline" aria-hidden>
            •
          </span>
          <span>{brand.announcement.text}</span>
          <Link to={brand.announcement.href} className="font-medium underline underline-offset-2">
            {brand.announcement.cta}
          </Link>
        </div>
      </div>
    </header>
  );
}

function MobileSection({
  label,
  items,
  onNavigate,
}: {
  label: string;
  items: NavItem[];
  onNavigate: () => void;
}) {
  return (
    <div className="py-3">
      <div className="mb-2 text-[11px] font-medium uppercase tracking-widest text-ink-mute">
        {label}
      </div>
      <ul className="grid gap-1">
        {items.map((it) => (
          <li key={it.to}>
            <Link
              to={it.to}
              onClick={onNavigate}
              className="flex min-h-11 items-center rounded-md px-2 py-2 text-sm text-ink hover:bg-surface-sunken"
            >
              {it.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
