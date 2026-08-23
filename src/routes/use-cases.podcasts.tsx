import { createFileRoute } from "@tanstack/react-router";
import { UseCaseTemplate } from "@/components/marketing/use-case-template";
import { pageMeta } from "@/config/seo";

export const Route = createFileRoute("/use-cases/podcasts")({
  head: () =>
    pageMeta({
      title: "Podcast Clipping and Podcast-to-Shorts — Vidrial",
      description:
        "Clean long video podcasts, identify complete moments, add captions and prepare editable short-form clips without losing context.",
      path: "/use-cases/podcasts",
    }),
  component: () => (
    <UseCaseTemplate
      eyebrow="Podcasts"
      title="Video podcasts, without the dead air."
      lead="Multi-mic conversations cleaned up, chaptered, ready to publish."
      scenario={
        <>
          Two-camera, three-mic conversation. Long silences during questions. You want a 45-minute
          cut plus a five-minute preview.
        </>
      }
      prompts={[
        "Remove pauses over 700 ms and the tangent about food between 22:00 and 27:00.",
        "Draft a 5-minute preview highlighting the strongest questions.",
        "Add chapters based on the transcript.",
      ]}
      outcomes={[
        "Cleaner-feeling conversation",
        "One long cut, one preview cut",
        "Chapters and captions ready for YouTube",
      ]}
    />
  ),
});
