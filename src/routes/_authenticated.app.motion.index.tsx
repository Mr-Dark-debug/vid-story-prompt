import { createFileRoute, Link } from "@tanstack/react-router";
import { AppPageHeader } from "@/components/app/layout";
import { Button } from "@/components/ui/button";
import { listMotionProjects, getMotionCapabilities } from "@/services/motion/server";

export const Route = createFileRoute("/_authenticated/app/motion/")({
  head: () => ({ meta: [{ title: "Motion Studio — Vidrial" }] }),
  loader: async () => ({
    projects: await listMotionProjects(),
    capabilities: await getMotionCapabilities(),
  }),
  component: MotionProjects,
});

function MotionProjects() {
  const { projects } = Route.useLoaderData();
  return (
    <div>
      <AppPageHeader
        eyebrow="Motion Studio"
        title="Your motion projects"
        description="Build a scene from a brief, review its code and timing, then export an MP4."
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/app/motion/gallery">Browse prompts</Link>
            </Button>
            <Button asChild>
              <Link to="/app/motion/new">New motion project</Link>
            </Button>
          </>
        }
      />
      {projects.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-line-strong bg-surface-panel p-8 text-center sm:p-16">
          <h2 className="text-xl font-semibold text-ink">Begin with one clear story</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-ink-soft">
            Describe the words, data, mood and rhythm you want. Your versions stay private until you
            choose to submit a finished piece.
          </p>
          <Button asChild className="mt-6">
            <Link to="/app/motion/new">Write your first brief</Link>
          </Button>
        </section>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              to="/app/motion/$projectId"
              params={{ projectId: project.id }}
              className="min-w-0 rounded-2xl border border-line bg-surface-panel p-5 transition hover:border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember"
            >
              <span className="text-xs capitalize text-ink-mute">
                {project.status.replaceAll("_", " ")}
              </span>
              <h2 className="mt-3 truncate text-lg font-semibold text-ink">{project.title}</h2>
              <p className="mt-2 line-clamp-3 break-words text-sm text-ink-soft">
                {project.prompt}
              </p>
              <p className="mt-4 text-xs text-ink-mute">
                {project.renderSpec.aspect} · {project.renderSpec.durationSeconds}s ·{" "}
                {project.renderSpec.fps} fps
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
