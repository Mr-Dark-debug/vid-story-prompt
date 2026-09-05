import { createFileRoute, redirect } from "@tanstack/react-router";

// Retire the standalone editor without deleting any saved user media or history.
export const Route = createFileRoute("/_authenticated/app/templates")({
  beforeLoad: () => {
    throw redirect({ to: "/app/youtube-clipper", replace: true });
  },
});
