import { createFileRoute } from "@tanstack/react-router";
import { SimpleMarketingPage } from "@/components/marketing/simple-page";
import { pageMeta } from "@/config/seo";

export const Route = createFileRoute("/imprint")({
  head: () =>
    pageMeta({
      title: "Vidrial Imprint and Service Contacts",
      description:
        "Find Vidrial's product-preview status and contact channels for general, privacy, copyright and security enquiries.",
      path: "/imprint",
    }),
  component: ImprintPage,
});

function ImprintPage() {
  return (
    <SimpleMarketingPage eyebrow="Legal" title="Imprint" cta={false}>
      <p>
        Vidrial is a privately operated software service currently available in product preview.
        Formal company registration and registered-office details will be published here before paid
        commercial contracting begins.
      </p>
      <h3>Service contact</h3>
      <ul>
        <li>
          General enquiries: <a href="mailto:hello@vidrial.app">hello@vidrial.app</a>
        </li>
        <li>
          Privacy enquiries: <a href="mailto:privacy@vidrial.app">privacy@vidrial.app</a>
        </li>
        <li>
          Copyright notices: <a href="mailto:copyright@vidrial.app">copyright@vidrial.app</a>
        </li>
        <li>
          Security reports: <a href="mailto:security@vidrial.app">security@vidrial.app</a>
        </li>
      </ul>
      <p>
        Vidrial does not accept service of legal proceedings through general support channels unless
        applicable law requires otherwise.
      </p>
    </SimpleMarketingPage>
  );
}
