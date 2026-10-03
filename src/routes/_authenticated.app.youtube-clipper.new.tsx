import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { AppPageHeader } from "@/components/app/layout";
import { JobWizard } from "@/components/youtube-clipper/job-wizard";
import { getPublicConnectorCatalog } from "@/services/connectors/server";
import { getClipJobCreationContext } from "@/services/clipping/server";
import { getAiPreferences, listAiModels } from "@/services/ai/server";
import { modelKey } from "@/components/ai/model-catalog";

export const Route = createFileRoute("/_authenticated/app/youtube-clipper/new")({
  validateSearch: z.object({
    youtube: z.string().optional(),
    source: z.string().optional(),
    draft: z.string().uuid().optional(),
  }),
  loader: async () => {
    const [connectors, creationContext, aiModels, preferences] = await Promise.all([
      getPublicConnectorCatalog(),
      getClipJobCreationContext(),
      // Optional extras: a failure here must never block creating a job.
      listAiModels().catch(() => []),
      getAiPreferences().catch(() => []),
    ]);
    const planning = preferences.find((item) => item.purpose === "clip_planning");
    return {
      connectors,
      creationContext,
      aiModels,
      aiPreferredModelKey: planning ? modelKey(planning.credentialId, planning.modelId) : null,
    };
  },
  component: NewClipJob,
});

function NewClipJob() {
  const search = Route.useSearch();
  const { connectors, creationContext, aiModels, aiPreferredModelKey } = Route.useLoaderData();
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
        aiModels={aiModels}
        aiPreferredModelKey={aiPreferredModelKey}
        initialYoutube={search.youtube}
        initialSource={search.source}
        initialDraft={search.draft}
      />
    </div>
  );
}
