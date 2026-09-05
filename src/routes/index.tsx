import { createFileRoute } from "@tanstack/react-router";
import { YouTubeClipperPublicPage } from "@/components/youtube-clipper/public-page";
import { pageMeta } from "@/config/seo";
import { brand } from "@/config/brand";

export const Route = createFileRoute("/")({
  head: () =>
    pageMeta({ title: `${brand.name} — ${brand.tagline}`, description: brand.promise, path: "/" }),
  component: YouTubeClipperPublicPage,
});
