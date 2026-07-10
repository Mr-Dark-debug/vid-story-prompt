import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Sparkles,
  Scissors,
  Wand2,
  Music4,
  Captions,
  Search,
  FileVideo,
  Layers,
  ShieldCheck,
  ArrowRight,
  Check,
  Youtube,
  Mic,
  Smartphone,
  GraduationCap,
  MonitorPlay,
} from "lucide-react";
import { brand } from "@/config/brand";
import { MarketingLayout } from "@/components/marketing/layout";
import { Container, Section, SectionHeader, Eyebrow } from "@/components/primitives/section";
import { StatusDot } from "@/components/primitives/status-dot";
import { HeroEditor } from "@/components/marketing/hero-editor";
import { PromptComposer } from "@/components/marketing/prompt-composer";
import { MediaSearchDemo } from "@/components/marketing/media-search";
import { TimelineRibbon } from "@/components/primitives/timeline-ribbon";
import { CTAButton, FinalCTA } from "@/components/marketing/page-shell";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: `${brand.name} — ${brand.tagline}` },
      { name: "description", content: brand.promise },
      { property: "og:title", content: `${brand.name} — ${brand.tagline}` },
      { property: "og:description", content: brand.promise },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
});

function Index() {
  return (
    <MarketingLayout>
      <Hero />
      <Principles />
      <Workflow />
      <PromptSection />
      <FeatureNarrative />
      <AssetsFirst />
      <ExplainableAI />
      <ManualControl />
      <UseCases />
      <PricingPreview />
      <SecurityBlock />
      <FinalCTA
        headline="Your next edit can start with a sentence."
        body="Bring the footage. Describe the story. Keep the timeline."
      />
    </MarketingLayout>
  );
}

function Hero() {
  return (
    <Section className="pt-10 sm:pt-16">
      <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <Eyebrow>{brand.tagline}</Eyebrow>
          <h1 className="mt-5 font-display text-[2.6rem] font-medium leading-[1.02] tracking-tight text-ink sm:text-[3.6rem]">
            {brand.headline}
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">
            {brand.promise}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <CTAButton to="/signup">
              Start a project <ArrowRight className="h-4 w-4" />
            </CTAButton>
            <CTAButton to="/how-it-works" variant="secondary">
              See how it works
            </CTAButton>
          </div>
          <p className="mt-4 text-sm text-ink-mute">
            No credit card required. Your projects are private by default.
          </p>
        </div>
        <HeroEditor />
      </div>
      <div className="mt-14">
        <TimelineRibbon />
      </div>
    </Section>
  );
}

function Principle({
  title,
  body,
  icon: Icon,
}: {
  title: string;
  body: string;
  icon: typeof Sparkles;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface-panel p-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ember-soft text-ember-ink">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-4 font-display text-lg text-ink">{title}</h3>
      <p className="mt-1.5 text-sm text-ink-soft">{body}</p>
    </div>
  );
}

function Principles() {
  return (
    <Section className="pt-0">
      <div className="grid gap-4 md:grid-cols-3">
        <Principle
          icon={Search}
          title="Understands every clip"
          body="Search your footage by speaker, scene, action, transcript or tag."
        />
        <Principle
          icon={Wand2}
          title="Plans before it edits"
          body="Review the clips, operations, duration and estimated usage before applying major changes."
        />
        <Principle
          icon={Layers}
          title="Everything stays editable"
          body="Adjust the transcript, timeline, captions and audio manually at any point."
        />
      </div>
    </Section>
  );
}

function Workflow() {
  const steps = [
    { n: "01", t: "Add your footage", d: "Drag video, audio, images and subtitles into a project." },
    { n: "02", t: "Let us analyse it", d: "Transcription, scenes, speakers and tags — private to you." },
    { n: "03", t: "Describe the video", d: "One prompt, or a full editing brief. Selection is optional." },
    { n: "04", t: "Review, edit, export", d: "Accept the plan you want. Change the rest by hand." },
  ];
  return (
    <Section>
      <SectionHeader
        eyebrow="Workflow"
        title="From an untidy folder to an editable timeline"
        lead="A short, honest path from raw material to a first cut you actually recognise."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <div
            key={s.n}
            className="relative rounded-2xl border border-line bg-surface-panel p-6"
          >
            <div className="font-mono text-xs text-ember-ink">{s.n}</div>
            <div className="mt-3 font-display text-lg text-ink">{s.t}</div>
            <div className="mt-1 text-sm text-ink-soft">{s.d}</div>
            {i < steps.length - 1 && (
              <ArrowRight className="absolute -right-2 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-line-strong lg:block" />
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}

function PromptSection() {
  return (
    <Section className="border-y border-line bg-surface-raised">
      <SectionHeader
        eyebrow="A conversation, not a command line"
        title="Ask for an edit. Read the plan before it happens."
        lead="The AI editor turns a sentence into a concrete list of operations you can accept, reject or refine."
      />
      <PromptComposer />
    </Section>
  );
}

const featureGroups = [
  {
    title: "Understand the project",
    items: [
      "Transcription",
      "Speaker identification",
      "Scene detection",
      "Automatic tags",
      "Semantic search",
      "Audio and quality analysis",
    ],
  },
  {
    title: "Create the first cut",
    items: [
      "Natural-language requests",
      "Edit-plan preview",
      "Take selection",
      "Silence and filler removal",
      "Transcript editing",
      "Uploaded B-roll placement",
    ],
  },
  {
    title: "Refine manually",
    items: [
      "Multi-track timeline",
      "Caption editor",
      "Audio controls",
      "Reframing",
      "Transitions",
      "Version history",
    ],
  },
  {
    title: "Deliver",
    items: [
      "Aspect-ratio variants",
      "Export presets",
      "Render monitoring",
      "Project sharing",
      "XML export (planned)",
    ],
  },
];

function FeatureNarrative() {
  return (
    <Section>
      <SectionHeader
        eyebrow="Features"
        title="Grouped around what you're actually doing"
        lead="Not a hundred-icon grid. A workflow, with the surface area of a real editor."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {featureGroups.map((g) => (
          <div key={g.title} className="rounded-2xl border border-line bg-surface-panel p-6">
            <div className="font-display text-lg text-ink">{g.title}</div>
            <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
              {g.items.map((it) => (
                <li key={it} className="flex items-center gap-2 text-sm text-ink-soft">
                  <Check className="h-3.5 w-3.5 text-ember" /> {it}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}

function AssetsFirst() {
  return (
    <Section className="border-t border-line bg-surface-raised">
      <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <Eyebrow>Uploaded assets first</Eyebrow>
          <h2 className="mt-4 font-display text-3xl leading-tight text-ink sm:text-4xl">
            Use what you already filmed.
          </h2>
          <p className="mt-4 max-w-md text-ink-soft">
            Vidrial searches your project before suggesting stock or generated footage. Your story should look like your story.
          </p>
        </div>
        <MediaSearchDemo />
      </div>
    </Section>
  );
}

function ExplainableAI() {
  const rows = [
    { op: "Remove 14 long pauses", detail: "Silence longer than 700 ms" },
    { op: "Use take 3 instead of take 1", detail: "02:14 – 02:41 · higher clarity" },
    { op: "Insert station-wide.mov", detail: "01:12 – 01:19 · B-roll" },
    { op: "Add caption preset · Clean Editorial", detail: "Whole timeline" },
    { op: "Reduce music by 8 dB under dialogue", detail: "Audio track 2" },
    { op: "Create 16:9 and 9:16 versions", detail: "Two exports" },
  ];
  return (
    <Section>
      <SectionHeader
        eyebrow="Explainable"
        title="An editor should show its work."
        lead="Every AI decision is a card. Preview it, accept it, edit it, or throw it out."
      />
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((r) => (
          <div
            key={r.op}
            className="flex items-start justify-between gap-4 rounded-xl border border-line bg-surface-panel px-4 py-3"
          >
            <div>
              <div className="text-sm font-medium text-ink">{r.op}</div>
              <div className="mt-0.5 text-xs text-ink-mute">{r.detail}</div>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <button className="rounded-md border border-line bg-surface-page px-2 py-1 text-[11px] text-ink hover:bg-surface-sunken">
                Preview
              </button>
              <button className="rounded-md bg-ink px-2 py-1 text-[11px] text-surface-page">
                Accept
              </button>
              <button className="rounded-md border border-line bg-surface-page px-2 py-1 text-[11px] text-ink-soft">
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function ManualControl() {
  return (
    <Section className="border-t border-line bg-surface-raised">
      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <Eyebrow>Manual control</Eyebrow>
          <h2 className="mt-4 font-display text-3xl leading-tight text-ink sm:text-4xl">
            Ask for the first cut. Keep control of the final one.
          </h2>
          <p className="mt-4 max-w-md text-ink-soft">
            The transcript, the timeline and the AI editor all modify the same project. Change any of them and the others stay in sync.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { i: FileVideo, t: "Transcript" },
            { i: Layers, t: "Timeline" },
            { i: Wand2, t: "AI editor" },
          ].map((c) => (
            <div key={c.t} className="rounded-2xl border border-line bg-surface-panel p-5">
              <c.i className="h-5 w-5 text-ember" />
              <div className="mt-4 font-display text-base text-ink">{c.t}</div>
              <div className="mt-1 text-[12.5px] text-ink-mute">Same source of truth.</div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

function UseCases() {
  const cases = [
    { i: Youtube, t: "YouTube videos", to: "/use-cases/youtube" },
    { i: Mic, t: "Video podcasts", to: "/use-cases/podcasts" },
    { i: Smartphone, t: "Short-form clips", to: "/use-cases/short-form" },
    { i: GraduationCap, t: "Online lessons", to: "/use-cases/courses" },
    { i: MonitorPlay, t: "Product demos", to: "/use-cases/product-demos" },
  ];
  return (
    <Section>
      <SectionHeader eyebrow="Use cases" title="Built around the way people make video" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cases.map((c) => (
          <Link
            key={c.t}
            to={c.to}
            className="group rounded-2xl border border-line bg-surface-panel p-5 transition-colors hover:border-line-strong"
          >
            <c.i className="h-5 w-5 text-ember" />
            <div className="mt-4 font-display text-base text-ink">{c.t}</div>
            <div className="mt-1 flex items-center gap-1 text-[12px] text-ink-mute group-hover:text-ink">
              Explore <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </Link>
        ))}
      </div>
    </Section>
  );
}

function PricingPreview() {
  const plans = [
    { name: "Free", price: "$0", note: "3 projects · 60 source minutes" },
    { name: "Creator", price: "$18", note: "600 minutes · captions · no watermark", featured: true },
    { name: "Pro", price: "$39", note: "1,800 minutes · 4K · priority" },
  ];
  return (
    <Section className="border-t border-line bg-surface-raised">
      <SectionHeader
        eyebrow="Pricing"
        title="Simple plans, honest units"
        lead="Editing uses source minutes. Generated media uses separate credits. You always see the cost before an expensive operation."
      />
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((p) => (
          <div
            key={p.name}
            className={`rounded-2xl border p-6 ${
              p.featured ? "border-ember bg-surface-panel ring-2 ring-ember/20" : "border-line bg-surface-panel"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="font-display text-lg text-ink">{p.name}</div>
              {p.featured && <StatusDot variant="demo">Recommended</StatusDot>}
            </div>
            <div className="mt-3 font-display text-3xl text-ink">
              {p.price}
              <span className="text-sm text-ink-mute">/mo</span>
            </div>
            <div className="mt-1 text-sm text-ink-soft">{p.note}</div>
          </div>
        ))}
      </div>
      <div className="mt-6">
        <CTAButton to="/pricing" variant="secondary">
          See full pricing <ArrowRight className="h-4 w-4" />
        </CTAButton>
      </div>
    </Section>
  );
}

function SecurityBlock() {
  const items = [
    { i: ShieldCheck, t: "Private by default", d: "Projects only you (and people you invite) can see." },
    { i: Scissors, t: "Customer-controlled deletion", d: "Delete individual projects or your entire account." },
    { i: Captions, t: "No training on your uploads", d: "Unless you explicitly opt in — off by default." },
    { i: Music4, t: "Clear retention", d: "You choose how long we keep media around." },
  ];
  return (
    <Section>
      <SectionHeader
        eyebrow="Security & privacy"
        title="Your footage, on your terms"
        lead="We don't display certifications we haven't earned. Here's what we actually do."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((it) => (
          <div key={it.t} className="rounded-2xl border border-line bg-surface-panel p-5">
            <it.i className="h-5 w-5 text-teal" />
            <div className="mt-3 font-display text-base text-ink">{it.t}</div>
            <div className="mt-1 text-sm text-ink-soft">{it.d}</div>
          </div>
        ))}
      </div>
    </Section>
  );
}
