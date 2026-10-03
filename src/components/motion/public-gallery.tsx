import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { MOTION_CATEGORIES } from "@/domain/motion/categories";
import { filterMotionPrompts, type PublicMotionPrompt } from "@/services/motion/catalog";
import { recordPublicMotionEvent, motionStudioHandoff } from "@/services/motion/public";
import { saveMotionDraft } from "@/services/motion/draft";
import { reportMotionPrompt } from "@/services/motion/server";
import { absoluteUrl, serializeJsonLd } from "@/config/seo";

const actionClass =
  "inline-flex min-h-11 items-center justify-center rounded-lg border border-line px-4 text-sm font-semibold text-ink hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember disabled:opacity-50";

export function MotionVideo({ prompt }: { prompt: PublicMotionPrompt }) {
  const [autoplay, setAutoplay] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const navigatorWithConnection = navigator as Navigator & {
      connection?: { saveData?: boolean };
    };
    const update = () =>
      setAutoplay(!reduced.matches && !navigatorWithConnection.connection?.saveData);
    update();
    reduced.addEventListener("change", update);
    return () => reduced.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const node = ref.current;
    if (!node || !autoplay) {
      node?.pause();
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void node.play().catch(() => {});
        else node.pause();
      },
      { threshold: 0.3 },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      node.pause();
    };
  }, [autoplay]);
  return (
    <div className="flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-surface-sunken text-ink-soft">
      {prompt.previewUrl ? (
        <video
          ref={ref}
          src={prompt.previewUrl}
          poster={prompt.posterUrl ?? undefined}
          muted
          loop
          playsInline
          controls={!autoplay}
          preload="none"
          aria-label={`${prompt.title} — original authored demo`}
          className="h-full w-full object-contain"
        />
      ) : (
        <div className="px-6 text-center">
          <p className="text-lg font-semibold text-ink">{prompt.title}</p>
          <p className="mt-2 text-xs">Original brief · Preview not yet rendered</p>
        </div>
      )}
    </div>
  );
}

export function UseMotionPrompt({
  prompt,
  children = "Use this prompt",
}: {
  prompt: PublicMotionPrompt;
  children?: React.ReactNode;
}) {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => setReady(true), []);
  return (
    <button
      disabled={!ready || busy}
      className={`${actionClass} bg-ink text-surface-page hover:bg-ink/90`}
      onClick={async () => {
        setBusy(true);
        try {
          const draft = saveMotionDraft({
            prompt: prompt.prompt,
            aspect: prompt.aspect as "16:9" | "1:1" | "9:16",
            durationSeconds: prompt.durationSeconds,
            sourcePromptId: prompt.localOriginal ? undefined : prompt.id,
          });
          void recordPublicMotionEvent(prompt, "use").catch(() => {});
          void navigate(await motionStudioHandoff(draft));
        } catch {
          toast.error(
            "Your browser could not save a private draft. Open Motion Studio and paste the prompt.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Opening…" : children}
    </button>
  );
}

export function CopyMotionPrompt({ prompt }: { prompt: PublicMotionPrompt }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className={actionClass}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(prompt.prompt);
          setCopied(true);
          void recordPublicMotionEvent(prompt, "copy").catch(() => {});
        } catch {
          toast.error("Clipboard access is unavailable. Select the prompt text and copy it.");
        }
      }}
    >
      {copied ? "Copied" : "Copy prompt"}
    </button>
  );
}

export function LikeMotionPrompt({ prompt }: { prompt: PublicMotionPrompt }) {
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  return (
    <button
      disabled={busy || !!prompt.localOriginal}
      className={actionClass}
      onClick={async () => {
        setBusy(true);
        try {
          await recordPublicMotionEvent(prompt, "like");
          setSaved(true);
          toast.success("Like saved.");
        } catch {
          toast.error("Sign in to like an approved gallery prompt.");
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Saving…" : saved ? "Like recorded" : "Like prompt"}
    </button>
  );
}

export function MotionPromptEmbed({ prompt }: { prompt: PublicMotionPrompt }) {
  return (
    <section
      className="my-8 min-w-0 rounded-2xl border border-line bg-surface-panel p-4 sm:p-6"
      aria-label={prompt.title}
    >
      {prompt.previewUrl && prompt.posterUrl && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd({
              "@context": "https://schema.org",
              "@type": "VideoObject",
              name: prompt.title,
              description: prompt.description ?? prompt.prompt.slice(0, 200),
              thumbnailUrl: [
                prompt.posterUrl.startsWith("/") ? absoluteUrl(prompt.posterUrl) : prompt.posterUrl,
              ],
              contentUrl: prompt.previewUrl.startsWith("/")
                ? absoluteUrl(prompt.previewUrl)
                : prompt.previewUrl,
              uploadDate: prompt.createdAt,
              duration: `PT${prompt.durationSeconds}S`,
            }),
          }}
        />
      )}
      <MotionVideo prompt={prompt} />
      <p className="mt-3 text-xs text-ink-mute">
        {prompt.durationSeconds}s · {prompt.aspect} · Original authored example, not a claimed AI
        generation
      </p>
      <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
        {prompt.prompt}
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <CopyMotionPrompt prompt={prompt} />
        <UseMotionPrompt prompt={prompt}>Try this prompt in Vidrial</UseMotionPrompt>
        {!prompt.localOriginal && <LikeMotionPrompt prompt={prompt} />}
      </div>
    </section>
  );
}

export function MotionPromptCard({ prompt }: { prompt: PublicMotionPrompt }) {
  return (
    <article className="flex min-w-0 flex-col rounded-2xl border border-line bg-surface-panel p-4">
      <MotionVideo prompt={prompt} />
      <p className="mt-4 text-xs text-ink-mute">
        By {prompt.authorDisplayName} ·{" "}
        <time dateTime={prompt.createdAt}>{prompt.createdAt.slice(0, 10)}</time>
      </p>
      <h3 className="mt-2 text-xl font-semibold text-ink">
        <Link to="/prompts/$slug" params={{ slug: prompt.slug }}>
          {prompt.title}
        </Link>
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        {prompt.prompt.slice(0, 120)}
        {prompt.prompt.length > 120 ? "…" : ""}
      </p>
      <p className="mt-3 text-xs text-ink-mute">
        {prompt.durationSeconds}s · {prompt.aspect}
        {!prompt.localOriginal && ` · ${prompt.viewCount} views · ${prompt.likeCount} likes`}
      </p>
      <Link
        to="/prompts/$slug"
        params={{ slug: prompt.slug }}
        className="mt-4 min-h-11 py-3 text-sm font-semibold text-ember-ink underline underline-offset-4"
      >
        View full prompt and copy
      </Link>
      <div className="mt-auto">
        <UseMotionPrompt prompt={prompt} />
      </div>
    </article>
  );
}

export function MotionPromptGrid({
  prompts,
  initialCategory = "",
}: {
  prompts: PublicMotionPrompt[];
  initialCategory?: string;
}) {
  const [category, setCategory] = useState(initialCategory);
  const [model, setModel] = useState("");
  const [style, setStyle] = useState("");
  const [sort, setSort] = useState("newest");
  const [query, setQuery] = useState("");
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const results = filterMotionPrompts(prompts, { category, model, style, sort, query });
  const models = [
    ...new Set(prompts.map((p) => p.recommendedModel).filter((m): m is string => !!m)),
  ];
  const styles = [...new Set(prompts.flatMap((p) => p.tags))].sort();
  return (
    <>
      <div className="flex flex-wrap gap-2" aria-label="Motion categories">
        <button aria-pressed={!category} onClick={() => setCategory("")} className={actionClass}>
          All ({prompts.length})
        </button>
        {MOTION_CATEGORIES.map((c) => (
          <button
            key={c.slug}
            className={actionClass}
            aria-pressed={category === c.slug}
            onClick={() => setCategory(c.slug)}
          >
            {c.label} ({prompts.filter((p) => p.category === c.slug).length})
          </button>
        ))}
      </div>
      <div className="my-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-sm text-ink">
          Search
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="mt-2 min-h-11 w-full rounded-lg border border-line bg-surface-panel px-3"
            placeholder="Find a story or style"
          />
        </label>
        <label className="text-sm text-ink">
          Model
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="mt-2 min-h-11 w-full rounded-lg border border-line bg-surface-panel px-3"
          >
            <option value="">Any model</option>
            {models.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        <label className="text-sm text-ink">
          Media type
          <select
            className="mt-2 min-h-11 w-full rounded-lg border border-line bg-surface-panel px-3"
            aria-label="Media type"
          >
            <option>HTML motion graphics</option>
          </select>
        </label>
        <label className="text-sm text-ink">
          Style
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            className="mt-2 min-h-11 w-full rounded-lg border border-line bg-surface-panel px-3"
          >
            <option value="">All styles</option>
            {styles.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="text-sm text-ink">
          Sort
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="mt-2 min-h-11 w-full rounded-lg border border-line bg-surface-panel px-3"
          >
            <option value="trending">Trending (uses, copies, likes)</option>
            <option value="likes">Most liked</option>
            <option value="views">Most viewed</option>
            <option value="newest">Newest</option>
          </select>
        </label>
      </div>
      <p
        role="status"
        aria-label="Motion results"
        data-hydrated={hydrated ? "true" : "false"}
        className="mb-5 text-sm text-ink-soft"
      >
        {results.length} {results.length === 1 ? "prompt" : "prompts"} · Original briefs, no
        invented engagement
      </p>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {results.map((p) => (
          <MotionPromptCard key={p.slug} prompt={p} />
        ))}
      </div>
      {!results.length && (
        <p className="rounded-xl border border-line p-8 text-ink-soft">
          No prompts match these filters. Choose another category or clear your search.
        </p>
      )}
    </>
  );
}

export function MotionPromptReport({ prompt }: { prompt: PublicMotionPrompt }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <details className="mt-8 text-sm text-ink-soft">
      <summary className="min-h-11 cursor-pointer py-3">Report this prompt</summary>
      <form
        className="mt-3 space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await reportMotionPrompt({ data: { promptId: prompt.id, reason } });
            toast.success("Report submitted for review.");
            setReason("");
          } catch {
            toast.error("Sign in to submit a report, or contact support for an official example.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="block">
          Reason
          <textarea
            required
            minLength={10}
            maxLength={2000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-2 block w-full rounded-lg border border-line bg-surface-panel p-3"
          />
        </label>
        <button disabled={busy || !!prompt.localOriginal} className={actionClass}>
          {busy ? "Submitting…" : "Submit report"}
        </button>
        {prompt.localOriginal && (
          <p>
            For this authored example,{" "}
            <a className="underline" href="mailto:support@vidrial.app">
              contact support
            </a>
            .
          </p>
        )}
      </form>
    </details>
  );
}
