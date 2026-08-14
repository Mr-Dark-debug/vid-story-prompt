import { createFileRoute } from "@tanstack/react-router";

import { sitemapIndexResponse } from "@/features/blog/discovery.server";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: () => sitemapIndexResponse(),
    },
  },
});
