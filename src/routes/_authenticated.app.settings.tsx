import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { AppPageHeader } from "@/components/app/layout";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/settings")({
  head: () => ({ meta: [{ title: "Settings — Vidrial" }] }),
  component: SettingsLayout,
});

const tabs: {
  to:
    | "/app/settings"
    | "/app/settings/preferences"
    | "/app/settings/notifications"
    | "/app/settings/privacy"
    | "/app/settings/integrations";
  label: string;
  end?: boolean;
}[] = [
  { to: "/app/settings", label: "Profile", end: true },
  { to: "/app/settings/preferences", label: "Preferences" },
  { to: "/app/settings/notifications", label: "Notifications" },
  { to: "/app/settings/privacy", label: "Privacy" },
  { to: "/app/settings/integrations", label: "Integrations" },
];

function SettingsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div>
      <AppPageHeader title="Settings" description="Control your account, preferences, and data." />
      <div className="mb-6 flex flex-wrap gap-1 border-b border-line">
        {tabs.map((t) => {
          const active = t.end ? pathname === t.to : pathname.startsWith(t.to);
          return (
            <Link
              key={t.to}
              to={t.to}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center border-b-2 px-3 py-2 text-sm text-ink-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember",
                active ? "border-ember text-ink" : "border-transparent",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
      <Outlet />
    </div>
  );
}
