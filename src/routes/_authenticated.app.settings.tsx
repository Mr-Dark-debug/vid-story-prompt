import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { Bell, Plug, Settings2, Shield, UserRound } from "lucide-react";
import { AppPageHeader } from "@/components/app/layout";
import { settingsNavItems } from "@/config/app-navigation";
import { cn } from "@/lib/utils";
import { SelectField } from "@/components/ui/select-field";

export const Route = createFileRoute("/_authenticated/app/settings")({
  head: () => ({ meta: [{ title: "Settings — Vidrial" }] }),
  component: SettingsLayout,
});

const icons = [UserRound, Settings2, Bell, Plug, Shield];

function SettingsLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const activePath = settingsNavItems.find((item) => item.to === pathname)?.to ?? "/app/settings";
  return (
    <div>
      <AppPageHeader
        eyebrow="Workspace"
        title="Settings"
        description="Manage your identity, workflow defaults, notifications, integrations, and data."
      />
      <div className="mb-5 lg:hidden">
        <SelectField
          label="Settings section"
          value={activePath}
          onValueChange={(value) => void navigate({ to: value as never })}
          options={settingsNavItems.map((item) => ({
            value: item.to,
            label: item.label,
            description: item.description,
          }))}
        />
      </div>
      <div className="grid items-start gap-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav
          aria-label="Settings"
          className="sticky top-24 hidden rounded-xl border border-line bg-surface-panel p-2 lg:block"
        >
          {settingsNavItems.map((item, index) => {
            const active =
              item.to === "/app/settings" ? pathname === item.to : pathname.startsWith(item.to);
            const Icon = icons[index];
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-12 items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-soft transition-colors hover:bg-surface-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember",
                  active && "bg-surface-sunken font-medium text-ink",
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="min-w-0">
                  <span className="block">{item.label}</span>
                  <span className="block truncate text-[11px] font-normal text-ink-mute">
                    {item.description}
                  </span>
                </span>
              </Link>
            );
          })}
        </nav>
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
