import { createFileRoute } from "@tanstack/react-router";
import { JobProgress } from "@/components/youtube-clipper/job-progress";
import { getClipJob } from "@/services/clipping/server";
import { getYouTubeConnection } from "@/services/youtube/oauth.server";
import { listYouTubePublishingJobs } from "@/services/youtube/publishing.server";
import {
  listSocialPublishingDestinations,
  listSocialPublishingJobs,
} from "@/services/connectors/publishing.server";
import { getPublicConnectorCatalog } from "@/services/connectors/server";

export const Route = createFileRoute("/_authenticated/app/youtube-clipper/jobs/$jobId")({
  loader: async ({ params }) => {
    const [job, youtubeConnection, publishingJobs, socialDestinations, socialPublishingJobs, catalog] = await Promise.all([
      getClipJob({ data: { jobId: params.jobId } }),
      getYouTubeConnection(),
      listYouTubePublishingJobs({ data: { clipJobId: params.jobId } }),
      listSocialPublishingDestinations(),
      listSocialPublishingJobs({ data: { clipJobId: params.jobId } }),
      getPublicConnectorCatalog(),
    ]);
    return {
      job,
      youtubeConnection,
      publishingJobs,
      socialDestinations,
      socialPublishingJobs,
      configuredSocialPlatforms: catalog
        .filter((connector) =>
          ["facebook", "instagram", "tiktok", "linkedin"].includes(connector.id),
        )
        .filter((connector) => connector.configured)
        .map((connector) => connector.id),
    };
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
      socialDestinations={data.socialDestinations}
      socialPublishingJobs={data.socialPublishingJobs}
      configuredSocialPlatforms={data.configuredSocialPlatforms}
    />
  );
}
