import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/docs/ai-editor")({
  beforeLoad: () => {
    throw redirect({ to: "/docs/getting-started", statusCode: 301 });
  },
});
