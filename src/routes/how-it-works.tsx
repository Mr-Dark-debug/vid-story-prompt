import { createFileRoute } from "@tanstack/react-router";
import { ClippingInfoPage } from "@/components/marketing/clipping-info-page";
import { pageMeta } from "@/config/seo";
const sections = [
  {
    title: "Add an authorised video",
    body: "Upload a file or paste an eligible public YouTube URL. Confirm your rights, check the source duration and choose settings within your plan.",
  },
  {
    title: "Choose your clips",
    body: "Set the number, target length, aspect ratio and caption style. Give the selection guidance about the moments you want.",
  },
  {
    title: "Follow the job",
    body: "The worker acquires media, analyses speech and scenes, selects complete moments and renders previews. You can leave the page and return to the saved job.",
  },
  {
    title: "Review and download",
    body: "Watch the proposed clips, check captions and framing, then queue exports. A ready download appears only after rendering and private storage upload finish.",
  },
];
export const Route = createFileRoute("/how-it-works")({
  head: () =>
    pageMeta({
      title: "How video clipping works — Vidrial",
      description:
        "Turn authorised long-form footage into short clips without building a timeline.",
      path: "/how-it-works",
    }),
  component: () => (
    <ClippingInfoPage
      title="One source. Four clear steps."
      lead="Turn authorised long-form footage into short clips without building a timeline."
      sections={sections}
    />
  ),
});
