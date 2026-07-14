import { createFileRoute } from "@tanstack/react-router";
import { SimpleMarketingPage } from "@/components/marketing/simple-page";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms — Vidrial" },
      { name: "description", content: "Terms governing the use of Vidrial." },
      { property: "og:url", content: "/terms" },
    ],
    links: [{ rel: "canonical", href: "/terms" }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <SimpleMarketingPage
      eyebrow="Legal"
      title="Terms of service"
      lead="The agreement that applies when you create an account or use Vidrial."
      cta={false}
    >
      <p>Effective 14 July 2026.</p>

      <h3>1. Agreement and eligibility</h3>
      <p>
        By using Vidrial, you agree to these terms and the policies linked from them. You must be
        legally able to enter this agreement. If you use Vidrial for an organisation, you confirm
        that you can accept these terms for that organisation.
      </p>

      <h3>2. Accounts and security</h3>
      <p>
        Provide accurate account information, protect your sign-in credentials, and notify us at
        <a href="mailto:security@vidrial.app"> security@vidrial.app</a> if you believe your account
        has been compromised. You are responsible for activity performed through your account.
      </p>

      <h3>3. Your content and permissions</h3>
      <p>
        You retain ownership of content you upload. You grant Vidrial a limited, non-exclusive
        licence to host, copy, transform, transcribe, render and transmit that content only as
        needed to provide, secure and improve the service. You confirm that you own the content or
        have every permission needed to process and publish it.
      </p>

      <h3>4. AI-assisted output</h3>
      <p>
        Clip recommendations, captions and other generated output can be incomplete or inaccurate.
        You are responsible for reviewing output before publishing it and for ensuring the final
        result complies with applicable law, platform rules and third-party rights.
      </p>

      <h3>5. Acceptable use</h3>
      <p>
        You must follow our <a href="/acceptable-use">Acceptable Use policy</a>. We may restrict or
        suspend activity that threatens the service, other users, third-party rights or applicable
        law.
      </p>

      <h3>6. Plans, charges and cancellation</h3>
      <p>
        Plan limits are shown before purchase. If paid plans are available, prices, billing period,
        taxes and renewal terms are shown at checkout. Subscriptions continue until cancelled and
        remain available through the paid period unless the checkout terms state otherwise. You can
        cancel from Billing or contact <a href="mailto:billing@vidrial.app">billing@vidrial.app</a>.
      </p>

      <h3>7. Availability, changes and termination</h3>
      <p>
        We work to keep Vidrial reliable but do not promise uninterrupted availability. You may stop
        using the service at any time and can export or delete account data from Privacy settings.
        We may suspend or terminate access for material violations, legal requirements or security
        risks, and will provide notice when reasonably possible.
      </p>

      <h3>8. Disclaimers and liability</h3>
      <p>
        To the extent permitted by law, Vidrial is provided “as is” without implied warranties. We
        are not liable for indirect, incidental, special, consequential or punitive damages, lost
        profits, lost revenue or loss of data. Our aggregate liability for claims relating to the
        service will not exceed the amount you paid to Vidrial during the twelve months before the
        event giving rise to the claim. Nothing in these terms limits liability that cannot legally
        be limited.
      </p>

      <h3>9. Changes and contact</h3>
      <p>
        We may update these terms. Material changes will be communicated through the service or by
        email and will apply prospectively. Questions can be sent to
        <a href="mailto:legal@vidrial.app"> legal@vidrial.app</a>.
      </p>
    </SimpleMarketingPage>
  );
}
