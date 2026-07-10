import { createFileRoute } from "@tanstack/react-router";
import { SimpleMarketingPage, PlaceholderNote } from "@/components/marketing/simple-page";

export const Route = createFileRoute("/copyright")({
  head: () => ({
    meta: [{ title: "Copyright & takedown — Vidrial" }, { name: "description", content: "How to submit a copyright notice." }, { property: "og:url", content: "/copyright" }],
    links: [{ rel: "canonical", href: "/copyright" }],
  }),
  component: () => (
    <SimpleMarketingPage eyebrow="Legal" title="Copyright & takedown" lead="How to report content that shouldn't be on Vidrial." cta={false}>
      <PlaceholderNote />
      <h3>Submitting a notice</h3>
      <p>Send notices to <a href="mailto:copyright@vidrial.app">copyright@vidrial.app</a> with the material, the location on Vidrial, your contact information and a good-faith statement.</p>
      <h3>Counter-notices</h3>
      <p>If you believe your content was removed in error, you can file a counter-notice per <code>[TO BE COMPLETED]</code>.</p>
    </SimpleMarketingPage>
  ),
});
