import { createFileRoute } from "@tanstack/react-router";
import { SimpleMarketingPage } from "@/components/marketing/simple-page";

export const Route = createFileRoute("/cookies")({
  head: () => ({
    meta: [{ title: "Cookies — Vidrial" }, { name: "description", content: "Cookie policy and settings." }, { property: "og:url", content: "/cookies" }],
    links: [{ rel: "canonical", href: "/cookies" }],
  }),
  component: () => (
    <SimpleMarketingPage eyebrow="Legal" title="Cookies" lead="Necessary cookies keep the site working. Optional ones only run if you say yes." cta={false}>
      <h3>Categories</h3>
      <ul>
        <li><strong>Necessary</strong>: authentication, session security, load balancing.</li>
        <li><strong>Analytics (optional)</strong>: understanding which features get used.</li>
        <li><strong>Marketing (optional)</strong>: none right now.</li>
      </ul>
      <p>You can change your consent at any time — the cookie banner has a "Cookie settings" link that returns you here.</p>
    </SimpleMarketingPage>
  ),
});
