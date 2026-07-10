import { createFileRoute } from "@tanstack/react-router";
import { UseCaseTemplate } from "@/components/marketing/use-case-template";

export const Route = createFileRoute("/use-cases/podcasts")({
  head: () => ({
    meta: [{ title: "For video podcasts — Vidrial" }, { name: "description", content: "Cut the silence, keep the conversation." }, { property: "og:url", content: "/use-cases/podcasts" }],
    links: [{ rel: "canonical", href: "/use-cases/podcasts" }],
  }),
  component: () => (
    <UseCaseTemplate
      eyebrow="Podcasts"
      title="Video podcasts, without the dead air."
      lead="Multi-mic conversations cleaned up, chaptered, ready to publish."
      scenario={<>Two-camera, three-mic conversation. Long silences during questions. You want a 45-minute cut plus a five-minute preview.</>}
      prompts={[
        "Remove pauses over 700 ms and the tangent about food between 22:00 and 27:00.",
        "Draft a 5-minute preview highlighting the strongest questions.",
        "Add chapters based on the transcript.",
      ]}
      outcomes={["Cleaner-feeling conversation", "One long cut, one preview cut", "Chapters and captions ready for YouTube"]}
    />
  ),
});
