import { createFileRoute } from "@tanstack/react-router";
import { SimpleMarketingPage } from "@/components/marketing/simple-page";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy — Vidrial" },
      { name: "description", content: "How Vidrial collects, uses, protects, and deletes data." },
      { property: "og:url", content: "/privacy" },
    ],
    links: [{ rel: "canonical", href: "/privacy" }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <SimpleMarketingPage
      eyebrow="Legal"
      title="Privacy policy"
      lead="What we collect, why we use it, and how you stay in control."
      cta={false}
    >
      <p>Last updated: 13 July 2026.</p>

      <h3>Data we collect</h3>
      <ul>
        <li>Account information such as your name, email address, and authentication records.</li>
        <li>
          Media you upload, owner-controlled source URLs, and derived artifacts such as transcripts,
          clips, captions, and exports.
        </li>
        <li>
          Operational records needed to run jobs, enforce plan limits, recover failures, prevent
          abuse, and protect the service.
        </li>
        <li>Optional product analytics only after the applicable consent has been provided.</li>
      </ul>

      <h3>Google and YouTube data</h3>
      <p>
        Connecting YouTube is optional. When you connect it, Vidrial requests permission to read the
        selected channel. We request the separate YouTube upload permission only when you enable
        publishing. We store the channel ID, channel title, avatar, granted scopes, connection
        status, automation rules, and encrypted OAuth access and refresh tokens.
      </p>
      <p>
        We use this data only to show the connected channel, detect channel uploads through
        YouTube&apos;s official notification service, create automation drafts, and upload an export
        when you explicitly approve or schedule it. Vidrial does not download source video from
        YouTube playback URLs and does not sell Google user data.
      </p>
      <p>
        You can disconnect YouTube in Settings → Integrations. Vidrial will attempt to revoke the
        Google token, erase stored token material, disable channel subscriptions and automation, and
        prevent new publishing work. You can also revoke access from your Google Account permissions
        page.
      </p>

      <h3>Retention and deletion</h3>
      <p>
        YouTube Clipper source and generated artifacts expire after 7 days on Free, 30 days on
        Creator, and 90 days on Pro unless you delete them earlier. Operational and security records
        may be retained longer when necessary to prevent fraud, resolve disputes, or meet legal
        obligations. Disconnecting an integration removes its secrets immediately; non-secret audit
        history is retained only as needed for account security and job history.
      </p>

      <h3>Processors and sharing</h3>
      <p>
        Vidrial uses service providers only to operate the product: Supabase for authentication,
        database, and storage; Vercel for the web application; Render for media processing;
        Cloudflare for abuse protection; configured AI providers such as Groq and OpenRouter for
        transcription and clip planning; and Google APIs for YouTube metadata, channel connection,
        notifications, and publishing. We do not permit processors to use your media or Google user
        data for unrelated advertising.
      </p>

      <h3>Your controls and rights</h3>
      <ul>
        <li>Access, export, or delete your projects and generated media.</li>
        <li>Disconnect YouTube and revoke its permissions at any time.</li>
        <li>Pause automation rules without deleting prior drafts or jobs.</li>
        <li>Revoke optional analytics and marketing consent.</li>
        <li>
          Contact <a href="mailto:privacy@vidrial.app">privacy@vidrial.app</a> for access,
          correction, deletion, or portability requests.
        </li>
      </ul>
    </SimpleMarketingPage>
  );
}
