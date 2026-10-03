import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { MarketingLayout } from "@/components/marketing/layout";
import { MarketingPageHero } from "@/components/marketing/page-shell";
import { Container } from "@/components/primitives/section";
import { MOTION_CATEGORIES } from "@/domain/motion/categories";
import { absoluteUrl, serializeJsonLd } from "@/config/seo";
import { saveMotionDraft } from "@/services/motion/draft";
import { motionStudioHandoff } from "@/services/motion/public";
import type { PublicMotionPrompt } from "@/services/motion/catalog";
import { MotionPromptGrid } from "./public-gallery";

const motionFaqs = [
  {
    question: "Does Claude generate the video pixels?",
    answer:
      "In this workflow a language model writes HTML animation code. A separate browser renderer seeks each frame and FFmpeg encodes an MP4. It is a code-generation workflow, not a video diffusion model.",
  },
  {
    question: "Where do these prompts and previews come from?",
    answer:
      "Vidrial authors the official briefs and illustrative demo scenes. They are original examples, not scraped creator work or claimed model outputs. Community submissions require permission and approval before appearing publicly.",
  },
  {
    question: "Can I use a different model?",
    answer:
      "The briefs describe a deterministic HTML contract rather than a model-specific API. Motion Studio offers the models configured for your deployment; a model name on a collection does not mean that model is enabled.",
  },
  {
    question: "Is MP4 export always available?",
    answer:
      "Export depends on the deployed schema, provider and isolated browser worker. The app reports actual availability and plan limits. A queued render becomes downloadable only after output verification.",
  },
  {
    question: "Can a reference video be copied?",
    answer:
      "Reference analysis is intended to extract pacing, palette and timing principles from media you are authorised to use. It does not grant rights to reproduce somebody else's content. Reference analysis stays disabled until its processing path is available.",
  },
];

export function MotionDisclaimer() {
  return (
    <p className="mt-10 border-t border-line pt-5 text-xs leading-relaxed text-ink-mute">
      Claude and Anthropic are names of their respective owners. Vidrial is not affiliated with
      Anthropic. Official examples are authored demonstrations; model availability and production
      rendering are shown in the app.
    </p>
  );
}

export function MotionFaq() {
  return (
    <section className="mt-16">
      <h2 className="text-3xl font-semibold text-ink">Questions about code-made motion</h2>
      <div className="mt-6 divide-y divide-line">
        {motionFaqs.map((faq) => (
          <details key={faq.question} className="py-5">
            <summary className="min-h-11 cursor-pointer font-semibold text-ink">
              {faq.question}
            </summary>
            <p className="mt-3 max-w-3xl leading-relaxed text-ink-soft">{faq.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function MotionCreationPanel() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState<"16:9" | "1:1" | "9:16">("16:9");
  const [durationSeconds, setDuration] = useState(8);
  const [preset, setPreset] = useState("auto");
  const [error, setError] = useState("");
  return (
    <section
      className="my-12 rounded-2xl border border-line bg-surface-panel p-5 sm:p-8"
      aria-labelledby="motion-create-title"
    >
      <h2 id="motion-create-title" className="text-2xl font-semibold text-ink">
        Make one from scratch
      </h2>
      <p className="mt-3 max-w-3xl leading-relaxed text-ink-soft">
        Describe one story. Save a private brief, then choose an available model and check your plan
        inside Motion Studio. Sign-in keeps your prompt in this browser tab.
      </p>
      <form
        className="mt-6 space-y-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            const draft = saveMotionDraft({
              prompt: preset === "auto" ? prompt : `${prompt}\nCreative direction: ${preset}.`,
              aspect,
              durationSeconds,
            });
            void navigate(await motionStudioHandoff(draft));
          } catch {
            setError(
              "Your browser could not preserve the draft. Copy your prompt and paste it in Motion Studio.",
            );
            toast.error("Private draft storage unavailable.");
          }
        }}
      >
        <label className="block text-sm font-semibold text-ink">
          Your motion brief
          <textarea
            required
            maxLength={11000}
            rows={5}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="mt-2 w-full rounded-xl border border-line bg-surface-page p-4 font-normal"
            placeholder="An 8-second film where one scattered idea becomes a clear next step. End on the exact words…"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm text-ink">
            Aspect ratio
            <select
              value={aspect}
              onChange={(e) => setAspect(e.target.value as typeof aspect)}
              className="mt-2 min-h-11 w-full rounded-lg border border-line bg-surface-page px-3"
            >
              <option>16:9</option>
              <option>1:1</option>
              <option>9:16</option>
            </select>
          </label>
          <label className="text-sm text-ink">
            Duration (seconds)
            <input
              type="number"
              min={2}
              max={60}
              required
              value={durationSeconds}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="mt-2 min-h-11 w-full rounded-lg border border-line bg-surface-page px-3"
            />
          </label>
          <label className="text-sm text-ink">
            Inspiration
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value)}
              className="mt-2 min-h-11 w-full rounded-lg border border-line bg-surface-page px-3"
            >
              <option value="auto">Auto · follow the story</option>
              <option value="quiet editorial">Quiet editorial</option>
              <option value="precise geometric">Precise geometric</option>
              <option value="expressive typography">Expressive typography</option>
            </select>
          </label>
          <label className="text-sm text-ink">
            Model
            <select
              disabled
              className="mt-2 min-h-11 w-full rounded-lg border border-line bg-surface-page px-3"
            >
              <option>Choose after sign-in</option>
            </select>
          </label>
        </div>
        <div className="rounded-xl bg-surface-sunken p-4 text-sm text-ink-soft">
          <span className="font-semibold text-ink">Reference video · Coming soon</span>
          <p className="mt-1">
            Optional rights-attested reference analysis will study timing principles. Upload is
            disabled until that worker capability is available.
          </p>
          <input
            type="file"
            accept="video/*"
            disabled
            aria-label="Reference video (coming soon)"
            className="mt-3 max-w-full"
          />
        </div>
        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}
        <button className="min-h-11 rounded-lg bg-ink px-5 text-sm font-semibold text-surface-page">
          Continue to Motion Studio
        </button>
      </form>
    </section>
  );
}

export function MotionPublicPage({
  prompts,
  databaseConnected,
  generator = false,
  collectionTitle,
  collectionDescription,
}: {
  prompts: PublicMotionPrompt[];
  databaseConnected: boolean;
  generator?: boolean;
  collectionTitle?: string;
  collectionDescription?: string;
}) {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: motionFaqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };
  const videos = prompts
    .filter((p) => p.previewUrl && p.posterUrl)
    .map((p) => ({
      "@context": "https://schema.org",
      "@type": "VideoObject",
      name: p.title,
      description: p.description ?? p.prompt.slice(0, 200),
      thumbnailUrl: [p.posterUrl!.startsWith("/") ? absoluteUrl(p.posterUrl!) : p.posterUrl!],
      contentUrl: p.previewUrl!.startsWith("/") ? absoluteUrl(p.previewUrl!) : p.previewUrl,
      uploadDate: p.createdAt,
      duration: `PT${p.durationSeconds}S`,
    }));
  return (
    <MarketingLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqSchema) }}
      />
      {videos.map((schema) => (
        <script
          key={schema.name}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }}
        />
      ))}
      <MarketingPageHero
        title={
          collectionTitle ??
          (generator ? "A story becomes motion." : "Good motion starts with a clear brief.")
        }
        lead={
          collectionDescription ??
          (generator
            ? "Explore original code-drawn motion pieces, borrow the structure of a brief, and bring your own story into Motion Studio."
            : "Original prompts for HTML video, typography and geometric animation. Copy a brief, adapt its story, and keep control of every frame.")
        }
        actions={
          <>
            <Link
              to="/app/motion/new"
              search={{ draft: undefined }}
              className="min-h-11 rounded-lg bg-ink px-5 py-3 font-semibold text-surface-page"
            >
              Open Motion Studio
            </Link>
            <Link
              to="/blog/$slug"
              params={{ slug: "claude-motion-graphics" }}
              className="min-h-11 rounded-lg border border-line px-5 py-3 font-semibold text-ink"
            >
              Read the practical guide
            </Link>
          </>
        }
      />
      <Container className="py-12">
        {generator && <MotionCreationPanel />}
        <p className="mb-6 max-w-3xl text-sm leading-relaxed text-ink-soft">
          {databaseConnected
            ? "Approved community entries use real Vidrial counters. "
            : "The live gallery is unavailable; these are our original authored examples. "}
          Preview films, where present, demonstrate the renderer and are not claimed AI outputs. All
          original counters begin at zero.
        </p>
        <MotionPromptGrid prompts={prompts} />
        <section className="mt-16">
          <h2 className="text-3xl font-semibold text-ink">Browse by the story you need</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {MOTION_CATEGORIES.map((c) => (
              <div key={c.slug} className="rounded-xl border border-line p-5">
                <h3 className="font-semibold text-ink">{c.label}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{c.description}</p>
              </div>
            ))}
          </div>
        </section>
        <MotionFaq />
        <section className="mt-16">
          <h2 className="text-2xl font-semibold text-ink">Keep the workflow connected</h2>
          <div className="mt-5 flex flex-wrap gap-4">
            <Link to="/docs/motion-studio" className="min-h-11 py-3 text-ember-ink underline">
              Motion Studio documentation
            </Link>
            <Link to="/youtube-clipper" className="min-h-11 py-3 text-ember-ink underline">
              Clip existing authorised video
            </Link>
            <Link
              to="/prompts/$slug"
              params={{ slug: "claude-opus-5-5" }}
              className="min-h-11 py-3 text-ember-ink underline"
            >
              Claude prompt collection
            </Link>
          </div>
        </section>
        <MotionDisclaimer />
      </Container>
    </MarketingLayout>
  );
}
