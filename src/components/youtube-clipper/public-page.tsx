import { Link } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Captions,
  Check,
  Download,
  Film,
  Frame,
  LockKeyhole,
  Play,
  Scissors,
  ShieldCheck,
  Sparkles,
  Upload,
  WandSparkles,
} from "lucide-react";
import { MarketingLayout } from "@/components/marketing/layout";
import { Container, Eyebrow, Section, SectionHeader } from "@/components/primitives/section";
import { TurnstileWidget } from "@/components/security/turnstile";
import { getPublicEnv } from "@/config/env";
import { userFacingError } from "@/lib/user-facing-error";
import { getYouTubeMetadata } from "@/services/youtube/server";

const demoClips = [
  {
    id: "origin",
    title: "Why constraints make better products",
    time: "02:18–02:54",
    score: 94,
    hook: 96,
    clarity: 93,
    caption: "Constraints are not the enemy of creativity.",
  },
  {
    id: "signal",
    title: "The signal hidden in customer complaints",
    time: "08:41–09:26",
    score: 91,
    hook: 89,
    clarity: 95,
    caption: "A complaint is often a badly written roadmap.",
  },
  {
    id: "choice",
    title: "One decision that ended six months of debate",
    time: "14:03–14:47",
    score: 88,
    hook: 92,
    clarity: 87,
    caption: "We stopped asking what could work.",
  },
  {
    id: "craft",
    title: "What craft looks like under pressure",
    time: "21:10–21:56",
    score: 86,
    hook: 84,
    clarity: 91,
    caption: "Quality is the part you protect when time disappears.",
  },
  {
    id: "finish",
    title: "The quiet advantage of finishing",
    time: "31:22–32:08",
    score: 84,
    hook: 82,
    clarity: 90,
    caption: "Finished work teaches you what planning cannot.",
  },
] as const;

type Metadata = Awaited<ReturnType<typeof getYouTubeMetadata>>;

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return [hours, minutes, secs]
    .filter((_, index) => hours > 0 || index > 0)
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

export function YouTubeClipperPublicPage() {
  const [url, setUrl] = useState("");
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const turnstileSiteKey = getPublicEnv().VITE_TURNSTILE_SITE_KEY;
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const analyse = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMetadata(null);
    try {
      setMetadata(
        await getYouTubeMetadata({ data: { url, turnstileToken: turnstileToken ?? undefined } }),
      );
    } catch (cause) {
      setError(
        userFacingError(cause, "Video details could not be retrieved. Check the URL and retry."),
      );
    } finally {
      setLoading(false);
      if (turnstileSiteKey) {
        setTurnstileToken(null);
        setTurnstileResetKey((value) => value + 1);
      }
    }
  };
  return (
    <MarketingLayout>
      <section className="relative overflow-hidden border-b border-line bg-surface-page pt-12 sm:pt-20">
        <div className="absolute inset-0 opacity-55 [background-image:linear-gradient(to_right,var(--line)_1px,transparent_1px),linear-gradient(to_bottom,var(--line)_1px,transparent_1px)] [background-size:52px_52px] [mask-image:linear-gradient(to_bottom,black,transparent_78%)]" />
        <Container className="relative pb-16 sm:pb-24">
          <div className="mx-auto max-w-4xl text-center">
            <Eyebrow>AI YouTube clip maker</Eyebrow>
            <h1 className="mt-5 font-display text-[2.7rem] font-medium leading-[.98] text-ink sm:text-6xl lg:text-7xl">
              Turn one long video into clips worth watching.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-ink-soft sm:text-lg">
              Add an authorised YouTube video or upload the original file. Vidrial finds complete
              moments, reframes the video, creates captions and gives you editable clips for Shorts,
              Reels and TikTok.
            </p>
          </div>
          <form
            onSubmit={analyse}
            className="mx-auto mt-9 max-w-3xl rounded-2xl border border-line-strong bg-surface-panel p-2 shadow-[0_30px_90px_-50px_rgba(72,43,24,.55)] sm:flex"
          >
            <label className="sr-only" htmlFor="youtube-url">
              YouTube video URL
            </label>
            <input
              id="youtube-url"
              required
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://youtube.com/watch?v=…"
              className="h-12 min-w-0 flex-1 rounded-xl bg-transparent px-4 text-sm text-ink outline-none placeholder:text-ink-mute"
            />
            <button
              aria-busy={loading || undefined}
              disabled={loading || Boolean(turnstileSiteKey && !turnstileToken)}
              className="flex min-h-12 w-full touch-manipulation items-center justify-center gap-2 rounded-xl bg-ink px-5 text-sm font-semibold text-surface-page transition-colors hover:bg-ink/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {loading ? "Retrieving details…" : "Analyse video"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
          {turnstileSiteKey ? (
            <div className="mx-auto mt-3 flex max-w-3xl justify-end">
              <TurnstileWidget
                siteKey={turnstileSiteKey}
                resetKey={turnstileResetKey}
                onToken={setTurnstileToken}
              />
            </div>
          ) : null}
          <div className="mx-auto mt-4 flex max-w-3xl flex-col items-center justify-between gap-3 text-xs text-ink-mute sm:flex-row">
            <Link
              to="/login"
              search={{ redirect: "/app/youtube-clipper/new?source=upload" }}
              className="inline-flex items-center gap-1.5 font-medium text-ember-ink hover:underline"
            >
              <Upload className="h-3.5 w-3.5" />
              Upload original instead
            </Link>
            <span>Start free with 60 source minutes each month.</span>
          </div>
          {error && (
            <div
              role="alert"
              className="mx-auto mt-5 max-w-3xl rounded-xl border border-danger/25 bg-danger/5 px-4 py-3 text-sm text-danger"
            >
              {error}
            </div>
          )}
          {metadata && <MetadataCard metadata={metadata} sourceUrl={url} />}
          <p className="mx-auto mt-6 max-w-2xl text-center text-xs text-ink-mute">
            Only upload or process content you own or are authorised to use.
          </p>
        </Container>
      </section>
      <ClipDemo />
      <FeatureStory />
      <Workflow />
      <PlanComparison />
      <RightsSection />
      <section className="border-t border-line bg-ink py-20 text-surface-page">
        <Container className="text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[.16em] text-ember-soft">
            From long-form to ready-to-refine
          </div>
          <h2 className="mx-auto mt-4 max-w-3xl font-display text-4xl sm:text-5xl">
            Find the moment. Keep the meaning. Finish it your way.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-surface-page/70">
            Start with an authorised source and see exactly why every moment was recommended.
          </p>
          <Link
            to="/login"
            search={{ redirect: "/app/youtube-clipper/new" }}
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-surface-page px-5 py-3 text-sm font-semibold text-ink"
          >
            Create clips free <ArrowRight className="h-4 w-4" />
          </Link>
        </Container>
      </section>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "Vidrial YouTube Clipper",
            applicationCategory: "MultimediaApplication",
            operatingSystem: "Web",
            description:
              "Find complete moments in authorised long videos, add captions, reframe and export editable social clips.",
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          }),
        }}
      />
    </MarketingLayout>
  );
}

function MetadataCard({ metadata, sourceUrl }: { metadata: Metadata; sourceUrl: string }) {
  return (
    <div className="mx-auto mt-6 grid max-w-3xl gap-4 rounded-2xl border border-line bg-surface-panel p-4 text-left sm:grid-cols-[180px_1fr]">
      <img
        src={metadata.thumbnailUrl}
        alt=""
        className="aspect-video w-full rounded-xl object-cover"
      />
      <div className="min-w-0 py-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-display text-lg text-ink">{metadata.title}</div>
            <div className="mt-1 text-xs text-ink-mute">
              {metadata.channelTitle} · {formatDuration(metadata.durationSeconds)}
            </div>
          </div>
          <span className="rounded-full bg-warning/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink">
            Ownership unknown
          </span>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-ink-soft">
          Your YouTube link is used to retrieve video details and verify the source. To create
          downloadable clips, provide the original file or another authorised media source.
        </p>
        <Link
          to="/login"
          search={{ redirect: `/app/youtube-clipper/new?youtube=${encodeURIComponent(sourceUrl)}` }}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ember-ink"
        >
          Continue with this video <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

function ClipDemo() {
  const [selected, setSelected] = useState<string[]>(["origin", "signal", "choice"]);
  const selectionText = useMemo(() => `${selected.length} selected`, [selected]);
  return (
    <Section>
      <SectionHeader
        eyebrow="Interactive demonstration"
        title="One conversation. Five complete moments."
        lead="A deterministic demonstration of how Vidrial ranks, explains and prepares clips. No media is uploaded."
      />
      <div className="overflow-hidden rounded-3xl border border-line bg-[#171817] text-white shadow-[0_35px_100px_-55px_rgba(32,28,24,.7)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-ember px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider">
              Demo
            </span>
            <span className="text-sm font-medium">The discipline of making things · 38:12</span>
          </div>
          <button className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black">
            <Download className="h-3.5 w-3.5" />
            Export {selectionText}
          </button>
        </div>
        <div className="grid lg:grid-cols-[1.1fr_.9fr]">
          <div className="border-b border-white/10 p-5 lg:border-b-0 lg:border-r">
            <div className="relative aspect-video overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_35%_35%,#5d4a3d,transparent_28%),linear-gradient(135deg,#272724,#101110)]">
              <div className="absolute inset-x-6 bottom-6">
                <div className="mx-auto max-w-md rounded-lg bg-black/75 px-4 py-2.5 text-center text-lg font-semibold shadow-xl">
                  Constraints are not the enemy of{" "}
                  <span className="text-[#ffc177]">creativity.</span>
                </div>
              </div>
              <button
                aria-label="Play demonstration"
                className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-black"
              >
                <Play className="ml-1 h-5 w-5 fill-current" />
              </button>
            </div>
            <div className="mt-5">
              <div className="mb-3 flex items-center justify-between text-[10px] uppercase tracking-wider text-white/45">
                <span>Source transcript</span>
                <span>02:18 / 38:12</span>
              </div>
              <div className="space-y-2 text-sm leading-relaxed text-white/55">
                <p>Most teams treat a constraint as a reason to lower the ambition.</p>
                <p className="rounded-lg border-l-2 border-[#ed8e4d] bg-white/5 px-3 py-2 text-white">
                  But the interesting work starts when the constraint forces a choice. Constraints
                  are not the enemy of creativity. They give creativity a shape.
                </p>
                <p>The question is not what would we do with unlimited time…</p>
              </div>
            </div>
          </div>
          <div className="max-h-[650px] overflow-y-auto p-4">
            <div className="mb-3 px-1 text-[10px] uppercase tracking-wider text-white/45">
              Recommended moments
            </div>
            <div className="space-y-2">
              {demoClips.map((clip, index) => {
                const checked = selected.includes(clip.id);
                return (
                  <button
                    key={clip.id}
                    onClick={() =>
                      setSelected((items) =>
                        checked ? items.filter((id) => id !== clip.id) : [...items, clip.id],
                      )
                    }
                    className={`grid w-full grid-cols-[46px_1fr_auto] gap-3 rounded-xl border p-3 text-left transition ${checked ? "border-[#ed8e4d]/70 bg-[#ed8e4d]/10" : "border-white/10 bg-white/[.025] hover:bg-white/5"}`}
                  >
                    <div className="flex aspect-[9/16] items-center justify-center rounded-md bg-gradient-to-b from-[#4c4038] to-[#1e211f] text-xs text-white/50">
                      {String(index + 1).padStart(2, "0")}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium leading-snug">{clip.title}</div>
                      <div className="mt-1 text-[11px] text-white/45">
                        {clip.time} · Hook {clip.hook} · Clarity {clip.clarity}
                      </div>
                      <div className="mt-2 line-clamp-1 text-[11px] text-white/65">
                        “{clip.caption}”
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-lg text-[#ffc177]">{clip.score}</div>
                      <div className="text-[9px] uppercase text-white/35">strength</div>
                      <div
                        className={`mt-3 ml-auto flex h-4 w-4 items-center justify-center rounded border ${checked ? "border-[#ed8e4d] bg-[#ed8e4d]" : "border-white/30"}`}
                      >
                        {checked && <Check className="h-3 w-3" />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

function FeatureStory() {
  const features = [
    {
      eyebrow: "Find complete moments",
      title: "A strong clip needs an ending, not just a hook.",
      body: "Vidrial looks for natural setup, turn and resolution. Every recommendation includes clip strength, standalone clarity, story completeness and the reason it was selected.",
      icon: Sparkles,
    },
    {
      eyebrow: "Keep the subject in frame",
      title: "Reframe for the format without losing the speaker.",
      body: "Choose fit, fill, centre crop, a manual focal point or a blurred background. Automatic tracking is labelled only when real tracking is available.",
      icon: Frame,
    },
    {
      eyebrow: "Captions ready for social video",
      title: "Readable captions that remain editable.",
      body: "Correct words, adjust timing, split or merge cues and export SRT or VTT. Final burned-in captions are rendered server-side for deterministic output.",
      icon: Captions,
    },
    {
      eyebrow: "Edit before exporting",
      title: "The recommendation is a starting point.",
      body: "Adjust timing, crop, captions, hook text and audio. Saved versions use the same immutable manifest that the worker renders.",
      icon: WandSparkles,
    },
    {
      eyebrow: "Download one clip or all of them",
      title: "Deliver the video and the context around it.",
      body: "Export individual MP4, SRT, VTT, transcript and metadata files, or build a sanitised ZIP for every selected clip.",
      icon: Download,
    },
  ];
  return (
    <div>
      {features.map((feature, index) => (
        <Section
          key={feature.eyebrow}
          className={index % 2 ? "border-y border-line bg-surface-raised" : ""}
        >
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div className={index % 2 ? "lg:order-2" : ""}>
              <Eyebrow>{feature.eyebrow}</Eyebrow>
              <h2 className="mt-4 max-w-xl font-display text-3xl leading-tight text-ink sm:text-4xl">
                {feature.title}
              </h2>
              <p className="mt-4 max-w-lg leading-relaxed text-ink-soft">{feature.body}</p>
            </div>
            <div className="relative min-h-72 overflow-hidden rounded-3xl border border-line bg-surface-panel p-7">
              <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-ember-soft blur-3xl" />
              <feature.icon className="relative h-7 w-7 text-ember" />
              <div className="relative mt-10 space-y-3">
                {[
                  "Source meaning preserved",
                  "Why Vidrial selected this",
                  "Editable before final render",
                ].map((label, row) => (
                  <div
                    key={label}
                    className="flex items-center gap-3 rounded-xl border border-line bg-surface-page px-4 py-3"
                  >
                    <span className="font-mono text-xs text-ember-ink">0{row + 1}</span>
                    <span className="text-sm text-ink-soft">{label}</span>
                    <Check className="ml-auto h-4 w-4 text-success" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>
      ))}
    </div>
  );
}

function Workflow() {
  const steps = [
    {
      icon: Film,
      title: "Add the source",
      body: "Paste a YouTube URL for details, then provide the authorised original media.",
    },
    {
      icon: ShieldCheck,
      title: "Confirm rights",
      body: "Record a versioned confirmation that you may edit and export the content.",
    },
    {
      icon: Scissors,
      title: "Review moments",
      body: "Watch clips as they finish and understand every selection score.",
    },
    {
      icon: Download,
      title: "Edit and export",
      body: "Correct captions, tune the crop and render individual or batch downloads.",
    },
  ];
  return (
    <Section className="border-y border-line bg-surface-raised">
      <SectionHeader
        eyebrow="Four-step workflow"
        title="Honest about the source. Precise about the result."
      />
      <div className="grid gap-4 md:grid-cols-4">
        {steps.map((step, index) => (
          <div key={step.title} className="rounded-2xl border border-line bg-surface-panel p-5">
            <div className="flex items-center justify-between">
              <step.icon className="h-5 w-5 text-ember" />
              <span className="font-mono text-xs text-ink-mute">0{index + 1}</span>
            </div>
            <h3 className="mt-6 font-display text-lg text-ink">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{step.body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function PlanComparison() {
  return (
    <Section>
      <SectionHeader
        eyebrow="Free versus paid"
        title="Start with a real workflow, then scale the limits."
      />
      <div className="overflow-hidden rounded-2xl border border-line">
        <div className="hidden grid-cols-[1.4fr_1fr_1fr] bg-surface-raised px-5 py-3 text-xs font-semibold text-ink sm:grid">
          <span>Capability</span>
          <span>Free</span>
          <span>Creator & Pro</span>
        </div>
        {[
          ["Source minutes / month", "60", "600–1,800"],
          ["Suggested clips / job", "5", "20–50"],
          ["Export resolution", "720p", "1080p–4K"],
          ["Watermark", "After one trial export", "None"],
          ["Retention", "7 days", "30–90 days"],
        ].map((row) => (
          <div
            key={row[0]}
            className="grid gap-2 border-t border-line px-5 py-4 text-sm sm:grid-cols-[1.4fr_1fr_1fr] sm:gap-0"
          >
            <span className="font-medium text-ink">{row[0]}</span>
            <span className="text-ink-soft"><span className="font-medium text-ink sm:hidden">Free: </span>{row[1]}</span>
            <span className="text-ink-soft"><span className="font-medium text-ink sm:hidden">Creator & Pro: </span>{row[2]}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

function RightsSection() {
  return (
    <Section className="border-t border-line bg-surface-raised">
      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <Eyebrow>Copyright and privacy</Eyebrow>
          <h2 className="mt-4 font-display text-3xl text-ink sm:text-4xl">
            Authorised media in. Private artifacts out.
          </h2>
          <p className="mt-4 text-ink-soft">
            A YouTube link retrieves official details and can verify channel management. It does not
            give Vidrial the original media. Processing requires your file or another
            owner-controlled media source.
          </p>
        </div>
        <div className="grid gap-3">
          {[
            {
              icon: LockKeyhole,
              title: "Private storage",
              body: "Source media, previews and exports use private buckets and expiring signed URLs.",
            },
            {
              icon: ShieldCheck,
              title: "Versioned rights record",
              body: "Every processing job records the exact rights statement and policy version accepted.",
            },
            {
              icon: Scissors,
              title: "Retention you can see",
              body: "Artifacts expire by plan, and immediate deletion cancels pending work.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="flex gap-4 rounded-2xl border border-line bg-surface-panel p-5"
            >
              <item.icon className="mt-0.5 h-5 w-5 shrink-0 text-ember" />
              <div>
                <h3 className="font-medium text-ink">{item.title}</h3>
                <p className="mt-1 text-sm text-ink-soft">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
