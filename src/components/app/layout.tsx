import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FolderKanban,
  Layers3,
  UploadCloud,
  Gauge,
  CreditCard,
  HelpCircle,
  Settings,
  LogOut,
  Menu,
  X,
  Plus,
  Scissors,
} from "lucide-react";
import { useState } from "react";
import { authService, useSession } from "@/services/auth";
import { Logo } from "@/components/primitives/logo";
import { StatusDot } from "@/components/primitives/status-dot";
import { cn } from "@/lib/utils";
import { appNav } from "@/config/nav";

const navIcons = {
  "/app": LayoutDashboard,
  "/app/youtube-clipper": Scissors,
  "/app/projects": FolderKanban,
  "/app/templates": Layers3,
  "/app/uploads": UploadCloud,
  "/app/usage": Gauge,
  "/app/billing": CreditCard,
  "/app/settings": Settings,
  "/app/help": HelpCircle,
} as const;

export function AppLayout() {
  const user = useSession();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-dvh bg-surface-page">
      {/* Mobile top bar */}
      <header className="fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b border-line bg-surface-panel/95 px-4 py-3 backdrop-blur lg:hidden">
        <Logo to="/app" />
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          className="rounded-md border border-line p-2 text-ink"
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </header>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-line bg-surface-panel px-4 py-5 transition-transform lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <Logo to="/app" className="mb-6 hidden lg:flex" />
        <div className="mt-14 lg:mt-0">
          <Link
            to="/app/projects/new"
            className="flex w-full items-center justify-center gap-2 rounded-md bg-ink px-3 py-2 text-sm font-medium text-surface-page"
            onClick={() => setOpen(false)}
          >
            <Plus className="h-4 w-4" /> New project
          </Link>
        </div>
        <nav className="mt-5 flex flex-col gap-0.5">
          {appNav.map((n) => {
            const active =
              n.to === "/app"
                ? pathname === "/app"
                : pathname === n.to || pathname.startsWith(n.to + "/");
            const Icon = navIcons[n.to as keyof typeof navIcons];
            if (!Icon) return null;
            return (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-ink-soft hover:bg-surface-sunken hover:text-ink",
                  active && "bg-surface-sunken font-medium text-ink",
                )}
              >
                <Icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-line pt-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ember-soft font-display text-sm text-ember-ink">
              {(user?.name ?? "?").slice(0, 1)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-ink">{user?.name}</div>
              <div className="truncate text-[11px] text-ink-mute">{user?.email}</div>
            </div>
            <button
              className="rounded-md p-1.5 text-ink-mute hover:bg-surface-sunken hover:text-ink"
              aria-label="Sign out"
              onClick={async () => {
                await authService.logout();
                await navigate({ to: "/login" });
              }}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2">
            <StatusDot variant="success">Supabase session · {user?.plan ?? "free"}</StatusDot>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-20 bg-ink/40 lg:hidden"
          aria-hidden
        />
      )}

      <main className="min-w-0 flex-1 pt-14 lg:pt-0">
        <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export function AppPageHeader({
  title,
  eyebrow,
  actions,
  description,
}: {
  title: string;
  eyebrow?: string;
  actions?: React.ReactNode;
  description?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && (
          <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-mute">
            {eyebrow}
          </div>
        )}
        <h1 className="font-display text-2xl text-ink sm:text-3xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-ink-soft">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
