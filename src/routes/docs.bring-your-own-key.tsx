import { createFileRoute } from "@tanstack/react-router";
import { pageMeta } from "@/config/seo";
import { listAiProviders } from "@/domain/ai/providers";

const sections = [
  [
    "What it does",
    "Connect your own API key from an AI provider and Vidrial uses your models for chat, clip planning, social copy and the AI editor. You see which models your key can use, choose a default for each feature, and can switch model per chat or per clipping job.",
  ],
  [
    "How your key is stored",
    "Keys are checked with the provider, then encrypted before they are stored. After you save a key only its last four characters are shown, and it is never returned to your browser. You can replace, revoke (which erases the stored key) or delete a connection at any time.",
  ],
  [
    "What is sent to the provider",
    "Your chat messages and, when you choose to process a source with your key, transcript text and clip details are sent to that provider using your key. Their terms, pricing and data handling apply to that usage. Chats can attach a clip job as reference data; that content is treated as material to read, not as instructions.",
  ],
  [
    "What does not change",
    "Your key replaces Vidrial's model cost, not its processing. Transcription, rendering, storage and your plan's source-minute limits work exactly as before.",
  ],
  [
    "When something goes wrong",
    "If a provider rejects your key, the connection is marked as needing reconnection and Vidrial does not keep retrying it. Clip planning then falls back to the built-in selection, and the results page says that your model was not used and why. Rate limits and temporary provider errors are retried with backoff.",
  ],
  [
    "Chats and deletion",
    "Chat history is saved so you can return to it. Deleting a chat permanently erases its messages, and you can choose how long chats are kept.",
  ],
] as const;

export const Route = createFileRoute("/docs/bring-your-own-key")({
  head: () =>
    pageMeta({
      title: "Bring your own AI key — Vidrial Documentation",
      description:
        "Connect your own AI provider key to chat, plan clips and write copy with the models you choose.",
      path: "/docs/bring-your-own-key",
    }),
  component: BringYourOwnKey,
});

function BringYourOwnKey() {
  const available = listAiProviders("available");
  const beta = listAiProviders("beta");
  return (
    <article className="max-w-none text-ink-soft">
      <h1 className="font-display text-3xl text-ink">Bring your own AI key</h1>
      <p className="mt-4">
        Use the models you already pay for. Add a key in Settings, then AI providers.
      </p>
      <section className="mt-8">
        <h2 className="font-display text-xl text-ink">Supported providers</h2>
        <p className="mt-3 leading-relaxed">
          {available.map((provider) => provider.label).join(", ")}.
        </p>
        {beta.length ? (
          <p className="mt-3 leading-relaxed">
            In beta (implemented against the provider&rsquo;s documented API, not yet verified with
            live keys by Vidrial): {beta.map((provider) => provider.label).join(", ")}.
          </p>
        ) : null}
      </section>
      {sections.map(([heading, body]) => (
        <section key={heading} className="mt-8">
          <h2 className="font-display text-xl text-ink">{heading}</h2>
          <p className="mt-3 leading-relaxed">{body}</p>
        </section>
      ))}
    </article>
  );
}
