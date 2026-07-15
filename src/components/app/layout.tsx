import { Link, Outlet, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
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
import { AppBreadcrumbs } from "@/components/app/app-breadcrumbs";
import { GlobalSearch } from "@/components/app/global-search";
import { Logo, LogoMark } from "@/components/primitives/logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { appNavGroups } from "@/config/app-navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { userFacingError } from "@/lib/user-facing-error";
import { authService, useSession } from "@/services/auth";
import { getAccountPreferences } from "@/services/settings/server";

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
  const router = useRouter();
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
    void getAccountPreferences()
      .then((preferences) => {
        if (!active) return;
        const notifyOnce = (key: string, message: string) => {
          if (seenNotifications.current.has(key)) return;
          seenNotifications.current.add(key);
          toast.success(message);
        };
        channel = getSupabaseBrowserClient()
          .channel(`workspace-notifications-${user.id}`)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "exports",
              filter: `workspace_id=eq.${user.workspaceId}`,
            },
            (payload) => {
              const item = payload.new as { id?: string; status?: string };
              if (preferences.notifications.exportComplete && item.id && item.status === "complete")
                notifyOnce(`export-${item.id}`, "Your export is ready to download.");
            },
          )
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "clip_jobs",
              filter: `workspace_id=eq.${user.workspaceId}`,
            },
            (payload) => {
              const item = payload.new as { id?: string; status?: string };
              if (
                preferences.notifications.aiPlanComplete &&
                item.id &&
                ["ready", "completed"].includes(item.status ?? "")
              )
                notifyOnce(`job-${item.id}`, "Your clip analysis is ready to review.");
            },
          )
          .subscribe();
      })
      .catch(() => undefined);
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
    <TooltipProvider delayDuration={250}>
      <div className="flex min-h-dvh bg-surface-page">
        <aside
          aria-label="Workspace navigation"
          className={cn(
            "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-surface-panel p-3 transition-[width] duration-200 lg:flex",
            collapsed ? "w-[4.75rem]" : "w-[16.5rem]",
          )}
        >
          <div className="mb-4 flex min-h-11 items-center justify-between gap-2">
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setDesktopCollapsed(false)}
                    aria-label="Expand sidebar"
                    aria-expanded="false"
                    className="group relative mx-auto grid h-11 w-11 place-items-center rounded-md text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember"
                  >
                    <span className="transition-opacity group-hover:opacity-0 group-focus-visible:opacity-0">
                      <LogoMark className="h-8 w-8" />
                    </span>
                    <PanelLeftOpen className="absolute h-5 w-5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Expand sidebar</TooltipContent>
              </Tooltip>
            ) : (
              <>
                <Logo to="/app" variant="lockup" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Collapse sidebar"
                      aria-expanded="true"
                      onClick={() => setDesktopCollapsed(true)}
                    >
                      <PanelLeftClose />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Collapse sidebar</TooltipContent>
                </Tooltip>
              </>
            )}
          </div>
          {sidebar(collapsed)}
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-40 flex h-16 items-center gap-2 border-b border-line bg-surface-panel/95 px-4 backdrop-blur sm:px-6">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Open navigation"
                  className="lg:hidden"
                >
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[min(20rem,88vw)] bg-surface-panel p-4">
                <SheetHeader className="mb-5 text-left">
                  <SheetTitle>
                    <Logo to="/app" />
                  </SheetTitle>
                  <SheetDescription className="sr-only">
                    Navigate through your Vidrial workspace.
                  </SheetDescription>
                </SheetHeader>
                {sidebar(false, () => setMobileOpen(false))}
              </SheetContent>
            </Sheet>
            <div className="hidden items-center gap-1 lg:flex">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Go back"
                onClick={() => router.history.back()}
              >
                <ArrowLeft />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Go forward"
                onClick={() => router.history.forward()}
              >
                <ArrowRight />
              </Button>
            </div>
            <AppBreadcrumbs />
            <div className="ml-auto shrink-0">
              <GlobalSearch />
            </div>
          </header>
          <main
            id="main-content"
            tabIndex={-1}
            className="min-w-0 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ember"
          >
            <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8 lg:py-9">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </TooltipProvider>
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
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            to="/app/projects/new"
            aria-label={collapsed ? "New project" : undefined}
            className={cn(
              "flex min-h-11 items-center justify-center gap-2 rounded-md bg-ink px-3 text-sm font-medium text-surface-page transition-colors hover:bg-ink/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember",
              collapsed && "px-0",
            )}
            onClick={onNavigate}
          >
            <Plus className="h-4 w-4" />
            {!collapsed ? "New project" : null}
          </Link>
        </TooltipTrigger>
        {collapsed ? <TooltipContent side="right">New project</TooltipContent> : null}
      </Tooltip>

      <nav
        className="scrollbar-hidden mt-4 min-h-0 flex-1 space-y-5 overflow-y-auto"
        aria-label="Primary"
      >
        {appNavGroups.map((group) => (
          <div key={group.label}>
            {!collapsed ? (
              <div className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-mute">
                {group.label}
              </div>
            ) : null}
            <div className="space-y-1">
              {group.items.map((item) => {
                const active =
                  item.to === "/app"
                    ? pathname === "/app"
                    : pathname === item.to || pathname.startsWith(`${item.to}/`);
                const Icon = navIcons[item.to as keyof typeof navIcons];
                if (!Icon) return null;
                const link = (
                  <Link
                    to={item.to as never}
                    aria-current={active ? "page" : undefined}
                    aria-label={collapsed ? item.label : undefined}
                    onClick={onNavigate}
                    className={cn(
                      "flex min-h-10 items-center gap-2.5 rounded-md px-3 text-sm text-ink-soft transition-colors hover:bg-surface-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember",
                      active && "bg-surface-sunken font-medium text-ink",
                      collapsed && "justify-center px-0",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {!collapsed ? item.label : null}
                  </Link>
                );
                return collapsed ? (
                  <Tooltip key={item.to}>
                    <TooltipTrigger asChild>{link}</TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                ) : (
                  <div key={item.to}>{link}</div>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-4 border-t border-line pt-4">
        <div className={cn("flex items-center gap-3", collapsed && "flex-col")}>
          <Avatar
            aria-label={`${user?.name || "Your account"} profile`}
            className="h-10 w-10 border border-line bg-ember-soft"
          >
            {user?.avatarUrl ? (
              <AvatarImage
                src={user.avatarUrl}
                alt={`${user.name} profile photo`}
                referrerPolicy="no-referrer"
              />
            ) : null}
            <AvatarFallback className="bg-ember-soft font-display text-sm text-ember-ink">
              {(user?.name || user?.email || "A").slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-ink">
                {user?.name || "Your account"}
              </div>
              <div className="truncate text-[11px] text-ink-mute">{user?.email}</div>
            </div>
          ) : null}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                loading={signingOut}
                aria-label="Sign out"
                onClick={() => void onSignOut()}
              >
                <LogOut />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Sign out</TooltipContent>
          </Tooltip>
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
        <h1 className="text-balance font-display text-2xl text-ink sm:text-3xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm text-ink-soft">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
