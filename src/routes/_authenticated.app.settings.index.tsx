import { createFileRoute } from "@tanstack/react-router";
import { useSession } from "@/services/auth";
import { StatusDot } from "@/components/primitives/status-dot";

export const Route = createFileRoute("/_authenticated/app/settings/")({
  component: Profile,
});

function Profile() {
  const user = useSession();
  return (
    <form className="max-w-xl space-y-4 rounded-2xl border border-line bg-surface-panel p-6">
      <label className="block text-sm text-ink">Full name
        <input defaultValue={user?.name} className="mt-1 block w-full rounded-md border border-line bg-surface-page px-3 py-2 text-sm text-ink" />
      </label>
      <label className="block text-sm text-ink">Email
        <input defaultValue={user?.email} className="mt-1 block w-full rounded-md border border-line bg-surface-page px-3 py-2 text-sm text-ink" />
      </label>
      <div className="flex items-center justify-between pt-2">
        <StatusDot variant="demo">Changes are local</StatusDot>
        <button type="button" className="rounded-md bg-ink px-3 py-2 text-sm font-medium text-surface-page">Save</button>
      </div>
    </form>
  );
}