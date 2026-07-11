import { createFileRoute } from "@tanstack/react-router";
import { YouTubeClipperPublicPage } from "@/components/youtube-clipper/public-page";

export const Route = createFileRoute("/youtube-clipper")({
  head: () => ({
    meta: [
      { title: "YouTube Clipper — Turn Long Videos Into Shorts | Vidrial" },
      { name: "description", content: "Find complete moments in long videos, add captions, reframe speakers and export editable clips for YouTube Shorts, Instagram Reels and TikTok." },
      { property: "og:title", content: "YouTube Clipper — Turn Long Videos Into Shorts | Vidrial" },
      { property: "og:description", content: "Find complete moments in long videos, add captions, reframe speakers and export editable clips for YouTube Shorts, Instagram Reels and TikTok." },
      { property: "og:url", content: "/youtube-clipper" },
    ],
    links: [{ rel: "canonical", href: "/youtube-clipper" }],
  }),
  component: YouTubeClipperPublicPage,
});
