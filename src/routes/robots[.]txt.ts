import { createFileRoute } from "@tanstack/react-router";

import { robotsResponse } from "@/features/blog/discovery.server";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () => robotsResponse(),
    },
  },
});
