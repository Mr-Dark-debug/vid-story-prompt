import { createFileRoute } from "@tanstack/react-router";
import { ComingSoonPage } from "@/components/marketing/coming-soon";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Log in — Vidrial" }, { property: "og:url", content: "/login" }], links: [{ rel: "canonical", href: "/login" }] }),
  component: () => <ComingSoonPage eyebrow="Log in" title="Welcome back." lead="Sign-in will be enabled once the app shell ships in this preview." />,
});