import { createFileRoute } from "@tanstack/react-router";
import { ComingSoonPage } from "@/components/marketing/coming-soon";

export const Route = createFileRoute("/verify-email")({
  head: () => ({ meta: [{ title: "Verify email — Vidrial" }], links: [{ rel: "canonical", href: "/verify-email" }] }),
  component: () => <ComingSoonPage eyebrow="Verify email" title="Check your inbox." />,
});