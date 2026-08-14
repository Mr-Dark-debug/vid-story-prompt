import { createFileRoute } from "@tanstack/react-router";

import { rssResponse } from "@/features/blog/discovery.server";

export const Route = createFileRoute("/rss.xml")({
  server: {
    handlers: {
      GET: () => rssResponse(),
    },
  },
});
