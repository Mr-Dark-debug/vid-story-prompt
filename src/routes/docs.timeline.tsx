import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/docs/timeline")({
  beforeLoad: () => {
    throw redirect({ to: "/docs/getting-started", statusCode: 301 });
  },
});
