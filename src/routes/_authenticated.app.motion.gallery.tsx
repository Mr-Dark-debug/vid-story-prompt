import { createFileRoute } from "@tanstack/react-router";
import { AppPageHeader } from "@/components/app/layout";
import { MotionPromptGrid } from "@/components/motion/public-gallery";
import { MotionPublishForm } from "@/components/motion/motion-publish-form";
import { loadPublicMotionCatalog } from "@/services/motion/public";
import { listMotionProjects, getMotionCapabilities } from "@/services/motion/server";

export const Route = createFileRoute("/_authenticated/app/motion/gallery")({
  head: () => ({ meta: [{ title: "Motion gallery — Vidrial" }] }),
  loader: async () => ({
    catalog: await loadPublicMotionCatalog(),
    projects: await listMotionProjects(),
    capabilities: await getMotionCapabilities(),
  }),
  component: MotionGallery,
});
function MotionGallery() {
  const { catalog, projects, capabilities } = Route.useLoaderData();
  return (
    <div>
      <AppPageHeader
        eyebrow="Motion Studio"
        title="Find your next starting point"
        description="Original briefs and approved community work. Adapt the idea to your own words and facts."
      />
      <MotionPromptGrid prompts={catalog.prompts} />
      <section className="mt-10 rounded-2xl border border-line bg-surface-panel p-5 sm:p-6">
        <h2 className="text-xl font-semibold text-ink">Publish to the gallery</h2>
        <p className="mt-2 text-sm text-ink-soft">
          Choose a saved project version and grant permission for public reuse. Submissions remain
          private while moderation is pending.
        </p>
        <MotionPublishForm projects={projects} enabled={capabilities.availability === "beta"} />
      </section>
    </div>
  );
}
