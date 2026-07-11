import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/app/layout";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppLayout,
});