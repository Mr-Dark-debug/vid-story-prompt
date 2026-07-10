import { createFileRoute } from "@tanstack/react-router";
import { SimpleMarketingPage } from "@/components/marketing/simple-page";

export const Route = createFileRoute("/acceptable-use")({
  head: () => ({
    meta: [{ title: "Acceptable use — Vidrial" }, { name: "description", content: "What you can and can't do with Vidrial." }, { property: "og:url", content: "/acceptable-use" }],
    links: [{ rel: "canonical", href: "/acceptable-use" }],
  }),
  component: () => (
    <SimpleMarketingPage eyebrow="Legal" title="Acceptable use policy" lead="Short, direct, non-negotiable." cta={false}>
      <p>You may not use Vidrial to create, host or distribute:</p>
      <ul>
        <li>Illegal content.</li>
        <li>Non-consensual intimate content.</li>
        <li>Sexual exploitation of minors.</li>
        <li>Harassment, threats or targeted abuse.</li>
        <li>Impersonation or fraud.</li>
        <li>Malicious deepfakes intended to deceive.</li>
        <li>Copyright infringement, including uploading media you don't have rights to.</li>
        <li>Attempts to attack, overload or misuse the service.</li>
      </ul>
      <p>When you upload media, you confirm you have the rights and permissions needed to process it.</p>
      <p>Violations may result in immediate suspension and, where required, disclosure to authorities.</p>
    </SimpleMarketingPage>
  ),
});
