import { createFileRoute } from "@tanstack/react-router";
import { SimpleMarketingPage, PlaceholderNote } from "@/components/marketing/simple-page";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [{ title: "Terms — Vidrial" }, { name: "description", content: "Terms of service." }, { property: "og:url", content: "/terms" }],
    links: [{ rel: "canonical", href: "/terms" }],
  }),
  component: () => (
    <SimpleMarketingPage eyebrow="Legal" title="Terms of service" lead="The rules of the road for using Vidrial." cta={false}>
      <PlaceholderNote />
      <h3>1. Who we are</h3>
      <p>Vidrial is operated by <code>[TO BE COMPLETED]</code> (the "Company"). This is a working name that may change.</p>
      <h3>2. Your account</h3>
      <p>You're responsible for keeping your credentials safe and for activity under your account.</p>
      <h3>3. Your content</h3>
      <p>You keep ownership of everything you upload. You grant us the limited rights required to store, process and display it while providing the service.</p>
      <h3>4. Acceptable use</h3>
      <p>See our <a href="/acceptable-use">Acceptable Use policy</a> for prohibited behaviour.</p>
      <h3>5. Billing</h3>
      <p>Paid plans renew until cancelled. Refunds are handled per <code>[TO BE COMPLETED]</code>.</p>
      <h3>6. Termination</h3>
      <p>Either of us can end this agreement. We'll give you a reasonable window to export your work.</p>
      <h3>7. Disclaimers & liability</h3>
      <p><code>[TO BE COMPLETED — legal review required]</code></p>
      <h3>8. Governing law</h3>
      <p><code>[TO BE COMPLETED — legal review required]</code></p>
    </SimpleMarketingPage>
  ),
});
