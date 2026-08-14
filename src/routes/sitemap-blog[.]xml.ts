import { createFileRoute } from "@tanstack/react-router";

import { blogSitemapResponse } from "@/features/blog/discovery.server";

export const Route = createFileRoute("/sitemap-blog.xml")({
  server: {
    handlers: {
      GET: () => blogSitemapResponse(),
    },
  },
});
