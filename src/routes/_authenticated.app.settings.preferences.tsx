import { createFileRoute, Link } from "@tanstack/react-router";
import { SettingsSection } from "@/components/settings/settings-ui";
export const Route = createFileRoute("/_authenticated/app/settings/preferences")({
  component: Preferences,
});
function Preferences() {
  return (
    <SettingsSection
      title="Clipping preferences"
      description="Choose clip length, aspect ratio and caption style when you start each job. Standalone editor settings have been retired."
    >
      <div className="flex flex-wrap gap-3 py-4">
        <Link
          to="/app/youtube-clipper/new"
          className="inline-flex min-h-11 items-center rounded-lg bg-ink px-4 text-sm text-surface-page"
        >
          Create clips
        </Link>
        <Link
          to="/app/settings/notifications"
          className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm text-ink"
        >
          Notification preferences
        </Link>
      </div>
    </SettingsSection>
  );
}
