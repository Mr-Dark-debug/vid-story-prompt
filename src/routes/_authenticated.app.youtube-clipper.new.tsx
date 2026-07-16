import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { AppPageHeader } from "@/components/app/layout";
import { JobWizard } from "@/components/youtube-clipper/job-wizard";
import { getPublicConnectorCatalog } from "@/services/connectors/server";
import { getClipJobCreationContext } from "@/services/clipping/server";

export const Route = createFileRoute("/_authenticated/app/youtube-clipper/new")({
  validateSearch: z.object({
    youtube: z.string().optional(),
    source: z.string().optional(),
    draft: z.string().uuid().optional(),
  }),
  loader: async () => {
    const [connectors, creationContext] = await Promise.all([
      getPublicConnectorCatalog(),
      getClipJobCreationContext(),
    ]);
    return { connectors, creationContext };
  },
  component: NewClipJob,
});

function NewClipJob() {
  const search = Route.useSearch();
  const { connectors, creationContext } = Route.useLoaderData();
  return (
    <div className="mx-auto max-w-4xl">
      <AppPageHeader
        eyebrow="YouTube Clipper"
        title="Create a clipping job"
        description="You stay in control of the source, the selected moments and every edit."
      />
      <JobWizard
        connectors={connectors}
        creationContext={creationContext}
        initialYoutube={search.youtube}
        initialSource={search.source}
        initialDraft={search.draft}
      />
    </div>
  );
}
