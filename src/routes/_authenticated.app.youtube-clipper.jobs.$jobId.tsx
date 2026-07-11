import { createFileRoute } from "@tanstack/react-router";
import { JobProgress } from "@/components/youtube-clipper/job-progress";
import { getClipJob } from "@/services/clipping/server";

export const Route = createFileRoute("/_authenticated/app/youtube-clipper/jobs/$jobId")({
  loader: ({ params }) => getClipJob({ data: { jobId: params.jobId } }),
  component: ClipJobRoute,
});

function ClipJobRoute() {
  return <JobProgress data={Route.useLoaderData()} />;
}
