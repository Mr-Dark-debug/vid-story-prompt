import { createFileRoute } from "@tanstack/react-router";
import { ClippingInfoPage } from "@/components/marketing/clipping-info-page";
import { pageMeta } from "@/config/seo";
const sections = [
  {
    title: "Current product scope",
    body: "Authorised video imports, AI-assisted moment selection, clip captions, previews and exports. Standalone online video editing has been retired.",
  },
  {
    title: "Reliability priorities",
    body: "Improve source acquisition, transcription fallback, upload recovery and clear failure handling. Provider restrictions can still prevent individual imports.",
  },
  {
    title: "Workflow priorities",
    body: "Make long-running work easier to follow and improve clip review on small screens. Keep plan limits and download availability visible.",
  },
  {
    title: "Future evaluation",
    body: "Additional source and publishing connectors will remain unavailable until their authentication and delivery paths are verified. No committed launch dates.",
  },
];
export const Route = createFileRoute("/roadmap")({
  head: () =>
    pageMeta({
      title: "Clipping roadmap — Vidrial",
      description:
        "Our priorities are reliable acquisition, understandable progress and high-quality short clips. Future items are not purchase promises.",
      path: "/roadmap",
    }),
  component: () => (
    <ClippingInfoPage
      title="One product focus: better clips."
      lead="Our priorities are reliable acquisition, understandable progress and high-quality short clips. Future items are not purchase promises."
      sections={sections}
    />
  ),
});
