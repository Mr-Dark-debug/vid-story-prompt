import { createFileRoute } from "@tanstack/react-router";
import { ComingSoonPage } from "@/components/marketing/coming-soon";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset password — Vidrial" }], links: [{ rel: "canonical", href: "/reset-password" }] }),
  component: () => <ComingSoonPage eyebrow="Reset password" title="Set a new password." />,
});