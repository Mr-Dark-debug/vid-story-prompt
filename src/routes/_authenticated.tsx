import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getCurrentSession } from "@/services/auth/server";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    const session = await getCurrentSession();
    if (!session) {
      throw redirect({ to: "/login", search: { redirect: location.href } as never });
    }
    return { session };
  },
  component: () => <Outlet />,
});
