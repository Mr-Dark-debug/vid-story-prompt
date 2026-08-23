import { createFileRoute } from "@tanstack/react-router";
import { YouTubeClipperPublicPage } from "@/components/youtube-clipper/public-page";
import { pageMeta } from "@/config/seo";

export const Route = createFileRoute("/youtube-clipper")({
  head: () =>
    pageMeta({
      title: "YouTube Video Clipper — Turn Long Videos Into Shorts | Vidrial",
      description:
        "Find complete moments in authorised YouTube videos, correct captions and export editable clips for Shorts, Reels and TikTok.",
      path: "/youtube-clipper",
    }),
  component: YouTubeClipperPublicPage,
});
