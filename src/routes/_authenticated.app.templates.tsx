import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { GraduationCap, Mic, MonitorPlay, Smartphone, Sparkles, Youtube } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppPageHeader } from "@/components/app/layout";
import { Button } from "@/components/ui/button";
import { createProjectFromTemplate, listProjectTemplates } from "@/services/projects/server";
import { userFacingError } from "@/lib/user-facing-error";

export const Route = createFileRoute("/_authenticated/app/templates")({
  head: () => ({ meta: [{ title: "Templates — Vidrial" }] }),
  loader: () => listProjectTemplates(),
  component: Templates,
});
const icons = {
  youtube: Youtube,
  mic: Mic,
  smartphone: Smartphone,
  graduation: GraduationCap,
  monitor: MonitorPlay,
  sparkles: Sparkles,
} as const;
function Templates() {
  const templates = Route.useLoaderData();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <AppPageHeader
        title="Templates"
        eyebrow="Production library"
        description="Choose a production starting point. Vidrial creates a private project with an editable brief."
      />
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
        >
          {error}
        </p>
      )}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => {
          const Icon = icons[template.icon as keyof typeof icons] ?? Sparkles;
          return (
            <li
              key={template.id}
              className="flex flex-col rounded-2xl border border-line bg-surface-panel p-5"
            >
              <Icon aria-hidden="true" className="h-5 w-5 text-ember" />
              <h2 className="mt-3 font-display text-lg text-ink">{template.name}</h2>
              <p className="mt-1 flex-1 text-sm text-ink-soft">{template.description}</p>
              <div className="mt-3 text-xs text-ink-mute">Default aspect · {template.aspect}</div>
              <Button
                className="mt-4 w-full"
                variant="outline"
                loading={busy === template.id}
                loadingText="Creating project…"
                onClick={async () => {
                  setBusy(template.id);
                  setError(null);
                  try {
                    const result = await createProjectFromTemplate({
                      data: { templateId: template.id },
                    });
                    toast.success("Project created from template.");
                    await navigate({
                      to: "/app/projects/$projectId",
                      params: { projectId: result.projectId },
                    });
                  } catch (cause) {
                    const friendly = userFacingError(cause, "The template could not be used.");
                    setError(friendly);
                    toast.error(friendly);
                    setBusy(null);
                  }
                }}
              >
                Use template
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
