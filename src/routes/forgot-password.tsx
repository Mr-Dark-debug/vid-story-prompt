import { createFileRoute } from "@tanstack/react-router";
import { ComingSoonPage } from "@/components/marketing/coming-soon";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Forgot password — Vidrial" }], links: [{ rel: "canonical", href: "/forgot-password" }] }),
  component: () => <ComingSoonPage eyebrow="Forgot password" title="Reset your password." />,
});