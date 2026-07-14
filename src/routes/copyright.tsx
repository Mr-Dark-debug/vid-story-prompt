import { createFileRoute } from "@tanstack/react-router";
import { SimpleMarketingPage } from "@/components/marketing/simple-page";

export const Route = createFileRoute("/copyright")({
  head: () => ({
    meta: [
      { title: "Copyright and takedown — Vidrial" },
      { name: "description", content: "How to submit a copyright notice or counter-notice." },
      { property: "og:url", content: "/copyright" },
    ],
    links: [{ rel: "canonical", href: "/copyright" }],
  }),
  component: CopyrightPage,
});

function CopyrightPage() {
  return (
    <SimpleMarketingPage
      eyebrow="Legal"
      title="Copyright and takedown"
      lead="How rightsholders and users can report and resolve copyright concerns."
      cta={false}
    >
      <h3>Submit a copyright notice</h3>
      <p>
        Email <a href="mailto:copyright@vidrial.app">copyright@vidrial.app</a> with your full name
        and contact information, identification of the protected work, the precise Vidrial location
        of the material, and an explanation of why you believe the use is unauthorised.
      </p>
      <p>
        Include a good-faith statement that the disputed use is not authorised by the rightsholder,
        its agent or law; a statement that the information is accurate and that you are authorised
        to act; and your physical or electronic signature.
      </p>

      <h3>Our response</h3>
      <p>
        We may request additional information, restrict access to the reported material, notify the
        affected user and preserve records needed to resolve the report. Repeated infringement may
        result in account termination.
      </p>

      <h3>Submit a counter-notice</h3>
      <p>
        If your material was removed by mistake or misidentification, reply to the notice with your
        contact information, identification of the removed material and its former location, your
        reason for disputing removal, the legally required jurisdiction and service statements for
        your country, and your physical or electronic signature.
      </p>
      <p>
        False statements can create legal liability. Consider obtaining independent legal advice
        before submitting a notice or counter-notice.
      </p>
    </SimpleMarketingPage>
  );
}
