import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  CreditCard,
  FolderKanban,
  Gauge,
  HelpCircle,
  Layers3,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Scissors,
  Settings,
  UploadCloud,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { appNav } from "@/config/nav";
import { Logo } from "@/components/primitives/logo";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { userFacingError } from "@/lib/user-facing-error";
import { authService, useSession } from "@/services/auth";
import { getAccountPreferences } from "@/services/settings/server";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

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
  "/app/feedback": MessageSquare,
} as const;

export function AppLayout() {
  const user = useSession();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const seenNotifications = useRef(new Set<string>());

  useEffect(() => {
    setCollapsed(window.localStorage.getItem("vidrial-sidebar-collapsed") === "true");
  }, []);

  useEffect(() => {
    if (!user?.workspaceId) return;
    let active = true;
    let channel: ReturnType<ReturnType<typeof getSupabaseBrowserClient>["channel"]> | undefined;
    void getAccountPreferences().then((preferences) => {
      if (!active) return;
      const notifyOnce = (key: string, message: string) => {
        if (seenNotifications.current.has(key)) return;
        seenNotifications.current.add(key);
        toast.success(message);
      };
      channel = getSupabaseBrowserClient()
        .channel(`workspace-notifications-${user.id}`)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "exports", filter: `workspace_id=eq.${user.workspaceId}` }, (payload) => {
          const item = payload.new as { id?: string; status?: string };
          if (preferences.notifications.exportComplete && item.id && item.status === "complete") notifyOnce(`export-${item.id}`, "Your export is ready to download.");
        })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "clip_jobs", filter: `workspace_id=eq.${user.workspaceId}` }, (payload) => {
          const item = payload.new as { id?: string; status?: string };
          if (preferences.notifications.aiPlanComplete && item.id && ["ready", "completed"].includes(item.status ?? "")) notifyOnce(`job-${item.id}`, "Your clip analysis is ready to review.");
        })
        .subscribe();
    }).catch(() => undefined);
    return () => {
      active = false;
      if (channel) void getSupabaseBrowserClient().removeChannel(channel);
    };
  }, [user?.id, user?.workspaceId]);

  const setDesktopCollapsed = (next: boolean) => {
    setCollapsed(next);
    window.localStorage.setItem("vidrial-sidebar-collapsed", String(next));
  };

  const signOut = async () => {
    setSigningOut(true);
    try {
      await authService.logout();
      toast.success("You have been signed out.");
      await navigate({ to: "/login" });
    } catch (cause) {
      toast.error(userFacingError(cause, "Sign out failed. Please try again."));
      setSigningOut(false);
    }
  };

  const sidebar = (isCollapsed: boolean, onNavigate?: () => void) => (
    <SidebarContent
      collapsed={isCollapsed}
      pathname={pathname}
      user={user}
      signingOut={signingOut}
      onNavigate={onNavigate}
      onSignOut={signOut}
    />
  );

  return (
    <div className="flex min-h-dvh bg-surface-page">
      <header className="fixed inset-x-0 top-0 z-40 flex min-h-16 items-center justify-between border-b border-line bg-surface-panel/95 px-4 backdrop-blur lg:hidden">
        <Logo to="/app" />
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Open navigation">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[min(20rem,88vw)] bg-surface-panel p-4">
            <SheetHeader className="sr-only">
              <SheetTitle>Workspace navigation</SheetTitle>
              <SheetDescription>Navigate through your Vidrial workspace.</SheetDescription>
            </SheetHeader>
            {sidebar(false, () => setMobileOpen(false))}
          </SheetContent>
        </Sheet>
      </header>

      <aside
        aria-label="Workspace navigation"
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-surface-panel p-3 transition-[width] duration-200 lg:flex",
          collapsed ? "w-[4.75rem]" : "w-64",
        )}
      >
        <div
          className={cn(
            "mb-4 flex min-h-11 items-center",
            collapsed ? "justify-center" : "justify-between gap-2",
          )}
        >
          {!collapsed ? <Logo to="/app" /> : null}
          <Button
            variant="ghost"
            size="icon"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            onClick={() => setDesktopCollapsed(!collapsed)}
          >
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </Button>
        </div>
        {sidebar(collapsed)}
      </aside>

      <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 pt-16 outline-none lg:pt-0">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function SidebarContent({
  collapsed,
  pathname,
  user,
  signingOut,
  onNavigate,
  onSignOut,
}: {
  collapsed: boolean;
  pathname: string;
  user: ReturnType<typeof useSession>;
  signingOut: boolean;
  onNavigate?: () => void;
  onSignOut: () => Promise<void>;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Link
        to="/app/projects/new"
        aria-label={collapsed ? "New project" : undefined}
        title={collapsed ? "New project" : undefined}
        className={cn(
          "flex min-h-11 items-center justify-center gap-2 rounded-md bg-ink px-3 text-sm font-medium text-surface-page transition-colors hover:bg-ink/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember",
          collapsed && "px-0",
        )}
        onClick={onNavigate}
      >
        <Plus className="h-4 w-4" />
        {!collapsed ? "New project" : null}
      </Link>

      <nav className="mt-5 flex flex-col gap-1" aria-label="Primary">
        {appNav.map((item) => {
          const active =
            item.to === "/app"
              ? pathname === "/app"
              : pathname === item.to || pathname.startsWith(`${item.to}/`);
          const Icon = navIcons[item.to as keyof typeof navIcons];
          if (!Icon) return null;
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? "page" : undefined}
              aria-label={collapsed ? item.label : undefined}
              title={collapsed ? item.label : undefined}
              onClick={onNavigate}
              className={cn(
                "flex min-h-11 items-center gap-2.5 rounded-md px-3 text-sm text-ink-soft transition-colors hover:bg-surface-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember",
                active && "bg-surface-sunken font-medium text-ink",
                collapsed && "justify-center px-0",
              )}
            >
              <Icon className="h-4 w-4" />
              {!collapsed ? item.label : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-line pt-4">
        <div className={cn("flex items-center gap-3", collapsed && "flex-col")}>
          <div
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ember-soft font-display text-sm text-ember-ink"
          >
            {(user?.name || user?.email || "A").slice(0, 1).toUpperCase()}
          </div>
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-ink">
                {user?.name || "Your account"}
              </div>
              <div className="truncate text-[11px] text-ink-mute">{user?.email}</div>
            </div>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            loading={signingOut}
            aria-label="Sign out"
            title="Sign out"
            onClick={() => void onSignOut()}
          >
            <LogOut />
          </Button>
        </div>
      </div>
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
        {eyebrow ? (
          <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-mute">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="font-display text-2xl text-ink sm:text-3xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm text-ink-soft">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
