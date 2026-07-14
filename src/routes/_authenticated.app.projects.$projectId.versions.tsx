import { createFileRoute, useRouter } from "@tanstack/react-router";
import { History, RotateCcw, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/primitives/status-dot";
import { getProject, restoreProjectVersion } from "@/services/projects/server";

export const Route = createFileRoute("/_authenticated/app/projects/$projectId/versions")({
  loader: ({ params }) => getProject({ data: { projectId: params.projectId } }),
  component: VersionsPage,
});
function VersionsPage() {
  const { project, versions } = Route.useLoaderData();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const date = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
  return (
    <div>
      <div role="status" aria-live="polite" className="mb-3 min-h-5 text-sm text-ink-soft">
        {message}
      </div>
      <ol className="space-y-3">
        {versions.map((version, index) => (
          <li key={version.id} className="rounded-2xl border border-line bg-surface-panel p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                {version.kind === "ai" ? (
                  <Sparkles className="h-4 w-4 text-ember" />
                ) : (
                  <History className="h-4 w-4 text-ink-mute" />
                )}
                <span className="truncate font-display text-base text-ink">{version.label}</span>
                {index === 0 && <StatusDot variant="success">current</StatusDot>}
              </div>
              <div className="flex items-center gap-2 text-xs text-ink-mute">
                <time dateTime={version.created_at}>
                  {date.format(new Date(version.created_at))}
                </time>
                {index > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    loading={busy === version.id}
                    loadingText="Restoring…"
                    onClick={async () => {
                      setBusy(version.id);
                      setMessage(null);
                      try {
                        await restoreProjectVersion({
                          data: { projectId: project.id, versionId: version.id },
                        });
                        setMessage(`Restored “${version.label}”.`);
                        await router.invalidate();
                      } catch (cause) {
                        setMessage(
                          cause instanceof Error ? cause.message : "Version could not be restored.",
                        );
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    <RotateCcw />
                    Restore
                  </Button>
                )}
              </div>
            </div>
            <p className="mt-2 text-sm text-ink-soft">
              {version.summary || "Saved timeline version."}
            </p>
          </li>
        ))}
        {versions.length === 0 && (
          <li className="rounded-2xl border border-dashed border-line p-10 text-center text-sm text-ink-mute">
            No saved versions yet. Save from the editor to create one.
          </li>
        )}
      </ol>
    </div>
  );
}
