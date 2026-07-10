import { createFileRoute } from "@tanstack/react-router";
import { ComingSoonPage } from "@/components/marketing/coming-soon";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Sign up — Vidrial" }, { property: "og:url", content: "/signup" }], links: [{ rel: "canonical", href: "/signup" }] }),
  component: () => <ComingSoonPage eyebrow="Sign up" title="Create your workspace." lead="Account creation and onboarding land with the app shell." />,
});