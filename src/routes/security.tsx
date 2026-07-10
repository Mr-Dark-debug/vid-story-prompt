import { createFileRoute } from "@tanstack/react-router";
import { SimpleMarketingPage } from "@/components/marketing/simple-page";

export const Route = createFileRoute("/security")({
  head: () => ({
    meta: [
      { title: "Security & privacy — Vidrial" },
      { name: "description", content: "How Vidrial handles your media, what we promise, and what we don't." },
      { property: "og:url", content: "/security" },
    ],
    links: [{ rel: "canonical", href: "/security" }],
  }),
  component: SecurityPage,
});

function SecurityPage() {
  return (
    <SimpleMarketingPage
      eyebrow="Security & privacy"
      title="Your footage, on your terms."
      lead="We're honest about what we do and don't do. No certification badges we haven't actually earned."
    >
      <h3>What's true today</h3>
      <ul>
        <li>Projects are <strong>private by default</strong> — only you and people you explicitly invite can see them.</li>
        <li>You can delete individual projects or your entire account at any time.</li>
        <li>Your uploads are <strong>not used to train shared models</strong> by default.</li>
        <li>Media access uses expiring, signed URLs — we don't ship permanent public links.</li>
        <li>You can download a copy of your personal data.</li>
        <li>Consent for analytics and marketing is separate, revocable, and off by default for anything non-essential.</li>
      </ul>
      <h3>What we don't claim (yet)</h3>
      <ul>
        <li>No SOC 2, ISO 27001 or HIPAA badge — we're not certified, so we don't display those logos.</li>
        <li>No "enterprise-grade security" boilerplate. When we're ready to say something specific, we will.</li>
      </ul>
      <h3>Reporting a vulnerability</h3>
      <p>
        Please email <a href="mailto:security@vidrial.app">security@vidrial.app</a>.
        Include reproduction steps and, if you can, a proof of concept. We aim to acknowledge within two business days.
      </p>
    </SimpleMarketingPage>
  );
}