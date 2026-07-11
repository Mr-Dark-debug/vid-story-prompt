import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { authService } from "@/services/auth";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: ({ location }) => {
    if (typeof window === "undefined") return;
    if (!authService.current()) {
      throw redirect({ to: "/login", search: { redirect: location.href } as never });
    }
  },
  component: () => <Outlet />,
});