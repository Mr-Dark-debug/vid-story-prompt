import { createFileRoute } from "@tanstack/react-router";
import { SimpleMarketingPage, PlaceholderNote } from "@/components/marketing/simple-page";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [{ title: "Privacy — Vidrial" }, { name: "description", content: "Privacy policy." }, { property: "og:url", content: "/privacy" }],
    links: [{ rel: "canonical", href: "/privacy" }],
  }),
  component: () => (
    <SimpleMarketingPage eyebrow="Legal" title="Privacy policy" lead="What we collect, why, and how you stay in control." cta={false}>
      <PlaceholderNote />
      <h3>Data we collect</h3>
      <ul>
        <li>Account information you provide (name, email, password hash).</li>
        <li>Media you upload to your projects, plus derived analysis (transcripts, tags, scenes).</li>
        <li>Product usage necessary to operate the service (project events, export jobs, error reports).</li>
        <li>Optional analytics — only with your consent.</li>
      </ul>
      <h3>Retention</h3>
      <p>Configurable per project. Deleted projects are removed from live systems within <code>[TO BE COMPLETED]</code> days.</p>
      <h3>Sharing & processors</h3>
      <p>We use processors for hosting, storage, analytics, error reporting and AI model inference. The current list is at <code>[TO BE COMPLETED]</code>.</p>
      <h3>Your rights</h3>
      <ul>
        <li>Access, export and delete your data at any time.</li>
        <li>Revoke consent for analytics and marketing.</li>
        <li>Contact <a href="mailto:privacy@vidrial.app">privacy@vidrial.app</a> for any request.</li>
      </ul>
    </SimpleMarketingPage>
  ),
});
