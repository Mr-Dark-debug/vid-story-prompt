import { createFileRoute } from "@tanstack/react-router";
import { SimpleMarketingPage, PlaceholderNote } from "@/components/marketing/simple-page";

export const Route = createFileRoute("/imprint")({
  head: () => ({
    meta: [{ title: "Imprint — Vidrial" }, { name: "description", content: "Legal identity of the operator." }, { property: "og:url", content: "/imprint" }],
    links: [{ rel: "canonical", href: "/imprint" }],
  }),
  component: () => (
    <SimpleMarketingPage eyebrow="Legal" title="Imprint" cta={false}>
      <PlaceholderNote />
      <ul>
        <li><strong>Company</strong>: <code>[TO BE COMPLETED]</code></li>
        <li><strong>Registered office</strong>: <code>[TO BE COMPLETED]</code></li>
        <li><strong>Registration number</strong>: <code>[TO BE COMPLETED]</code></li>
        <li><strong>Represented by</strong>: <code>[TO BE COMPLETED]</code></li>
        <li><strong>Contact</strong>: <a href="mailto:hello@vidrial.app">hello@vidrial.app</a></li>
      </ul>
    </SimpleMarketingPage>
  ),
});
