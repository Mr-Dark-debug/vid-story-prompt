import { createFileRoute } from "@tanstack/react-router";
import { JobProgress } from "@/components/youtube-clipper/job-progress";
import { getClipJob } from "@/services/clipping/server";
import { getYouTubeConnection } from "@/services/youtube/oauth.server";
import { listYouTubePublishingJobs } from "@/services/youtube/publishing.server";

export const Route = createFileRoute("/_authenticated/app/youtube-clipper/jobs/$jobId")({
  loader: async ({ params }) => {
    const [job, youtubeConnection, publishingJobs] = await Promise.all([
      getClipJob({ data: { jobId: params.jobId } }),
      getYouTubeConnection(),
      listYouTubePublishingJobs({ data: { clipJobId: params.jobId } }),
    ]);
    return { job, youtubeConnection, publishingJobs };
  },
  component: ClipJobRoute,
});

function ClipJobRoute() {
  const data = Route.useLoaderData();
  return (
    <JobProgress
      data={data.job}
      youtubeConnection={data.youtubeConnection}
      publishingJobs={data.publishingJobs}
    />
  );
}
