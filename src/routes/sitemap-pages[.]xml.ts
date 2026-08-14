import { createFileRoute } from "@tanstack/react-router";

import { pagesSitemapResponse } from "@/features/blog/discovery.server";

export const Route = createFileRoute("/sitemap-pages.xml")({
  server: {
    handlers: {
      GET: () => pagesSitemapResponse(),
    },
  },
});
