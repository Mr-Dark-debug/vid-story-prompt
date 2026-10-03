import { createFileRoute } from "@tanstack/react-router";
import { AppPageHeader } from "@/components/app/layout";
import { MotionBriefForm } from "@/components/motion/motion-brief-form";
import { getMotionCapabilities, getMotionUsage } from "@/services/motion/server";
import { listWorkspaceUploads } from "@/services/projects/server";

export const Route = createFileRoute("/_authenticated/app/motion/new")({
  validateSearch: (search: Record<string, unknown>): { draft?: string } => ({
    draft:
      typeof search.draft === "string" && /^[a-f0-9-]{36}$/i.test(search.draft)
        ? search.draft
        : undefined,
  }),
  head: () => ({ meta: [{ title: "New motion project — Vidrial" }] }),
  loader: async () => {
    const capabilities = await getMotionCapabilities();
    const [usage, uploads] = await Promise.all([
      getMotionUsage(),
      capabilities.referenceEnabled ? listWorkspaceUploads() : Promise.resolve([]),
    ]);
    return { capabilities, usage, uploads };
  },
  component: NewMotionProject,
});

function NewMotionProject() {
  const { capabilities, usage, uploads } = Route.useLoaderData();
  const { draft } = Route.useSearch();
  return (
    <div>
      <AppPageHeader
        eyebrow="Motion Studio"
        title="Give your idea a rhythm"
        description="A coherent story, exact words and a little creative latitude make a useful brief."
      />
      <MotionBriefForm
        capabilities={capabilities}
        usage={usage}
        uploads={uploads}
        draftId={draft}
      />
    </div>
  );
}
