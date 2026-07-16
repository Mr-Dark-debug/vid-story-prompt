import { createFileRoute, useRouter } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { SettingsSaveBar, SettingsSection } from "@/components/settings/settings-ui";
import { Button } from "@/components/ui/button";
import { userFacingError } from "@/lib/user-facing-error";
import { getCurrentSession, updateProfile } from "@/services/auth/server";

export const Route = createFileRoute("/_authenticated/app/settings/")({
  loader: () => getCurrentSession(),
  component: Profile,
});

function Profile() {
  const user = Route.useLoaderData();
  const router = useRouter();
  const [name, setName] = useState(user?.name ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setMessage(null);
        try {
          await updateProfile({ data: { displayName: name } });
          setMessage("Profile saved.");
          await router.invalidate();
        } catch (cause) {
          setMessage(userFacingError(cause, "Profile could not be saved. Try again."));
        } finally {
          setBusy(false);
        }
      }}
    >
      <SettingsSection
        title="Profile"
        description="The identity shown throughout your Vidrial workspace."
      >
        <div className="grid gap-5 py-5 sm:max-w-xl">
          <label className="grid gap-1.5 text-sm font-medium text-ink">
            Full name
            <input
              name="displayName"
              autoComplete="name"
              required
              minLength={2}
              maxLength={80}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="min-h-11 rounded-md border border-line bg-surface-page px-3 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ember"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-ink">
            Verified email
            <div className="relative">
              <input
                value={user?.email ?? ""}
                readOnly
                type="email"
                name="email"
                autoComplete="email"
                spellCheck={false}
                className="min-h-11 w-full rounded-md border border-line bg-surface-sunken px-3 pr-10 text-sm font-normal text-ink-soft"
              />
              <ShieldCheck
                aria-label="Verified"
                className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-success"
              />
            </div>
            <span className="text-xs font-normal leading-5 text-ink-mute">
              Email changes require a new verification flow and are not performed from this form.
            </span>
          </label>
        </div>
      </SettingsSection>
      <SettingsSaveBar status={message}>
        <Button type="submit" loading={busy} loadingText="Saving…">
          Save profile
        </Button>
      </SettingsSaveBar>
    </form>
  );
}
