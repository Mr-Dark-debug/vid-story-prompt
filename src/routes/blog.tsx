import { createFileRoute, Outlet } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing/layout";

export const Route = createFileRoute("/blog")({
  component: BlogLayout,
});

function BlogLayout() {
  return (
    <MarketingLayout>
      <Outlet />
    </MarketingLayout>
  );
}
