import { createFileRoute, Link } from "@tanstack/react-router";
import { pageMeta } from "@/config/seo";

export const Route = createFileRoute("/docs/motion-studio")({
  head: () =>
    pageMeta({
      title: "Motion Studio: Contract, Limits & Privacy — Vidrial Docs",
      description:
        "Learn how a motion brief becomes deterministic HTML, how the isolated browser renders frames, and how Vidrial handles models, private versions and plan limits.",
      path: "/docs/motion-studio",
    }),
  component: () => (
    <article className="space-y-8 text-ink-soft">
      <header>
        <h1 className="text-3xl font-semibold text-ink">Motion Studio</h1>
        <p className="mt-4 leading-relaxed">
          A language model writes an editable HTML scene; a separate renderer turns its
          deterministic frames into MP4. Availability depends on your deployment's database,
          configured models and isolated rendering worker. The studio shows that state before you
          start.
        </p>
      </header>
      <section>
        <h2 className="text-xl font-semibold text-ink">Start with one story</h2>
        <p className="mt-3 leading-relaxed">
          Choose a prompt from the{" "}
          <Link to="/prompts" className="underline">
            original library
          </Link>{" "}
          or write a brief. Specify duration and aspect ratio, the exact strings and data to use, a
          beginning, a change and an ending. Describe how those moments should feel and leave space
          for visual decisions. Use fictional disclosures for example data and verify real claims
          yourself.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-ink">The seek contract</h2>
        <p className="mt-3 leading-relaxed">
          The scene sets window.DURATION in seconds and defines async window.seek(t). Every seek
          must reconstruct the complete frame for that time, regardless of the previously requested
          frame. Do not use timers, animation loops, wall-clock time, unseeded random numbers,
          network APIs or evaluated strings. Resources must be embedded locally. The linter rejects
          prohibited code before preview or render.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-surface-sunken p-4 text-sm text-ink">
          <code>
            {
              "window.DURATION = 8;\nwindow.seek = async function (t) {\n  // Clear and redraw the whole scene as a function of t.\n};"
            }
          </code>
        </pre>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-ink">Preview, review and versions</h2>
        <p className="mt-3 leading-relaxed">
          Preview runs in an opaque sandboxed iframe with scripts permitted and same-origin access
          denied. Scrub through the scene, read the generated code and request a specific
          refinement. Saving corrected code runs the linter again and creates an immutable version;
          previous versions remain reviewable. A lint pass is one check, not proof of visual quality
          or factual accuracy.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-ink">Export and limits</h2>
        <p className="mt-3 leading-relaxed">
          Server-side plan rules control duration, resolution, monthly render seconds, concurrency
          and watermarks. Free exports are limited to 720p and include a watermark. The worker
          independently checks entitlement. A render remains queued until the isolated browser
          worker is available; downloads appear only for verified outputs. CPU rendering is metered
          separately from model usage.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-ink">Isolation</h2>
        <p className="mt-3 leading-relaxed">
          Generated JavaScript is untrusted. Production rendering requires a disposable container
          with no provider or Supabase credentials, no outbound network, a read-only root, a bounded
          temporary mount and CPU, memory, process and time limits. Browser request blocking and a
          restrictive Content Security Policy add another layer. Source code is never executed in
          the privileged queue controller. Missing isolation disables rendering.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-ink">Models and privacy</h2>
        <p className="mt-3 leading-relaxed">
          Your brief, exact text and relevant prior scene code are sent to the selected configured
          model. The current platform adapter uses OpenRouter when enabled; provider and model
          appear in the job record. Personal-key support uses the credential-resolution seam when
          its deployment is available. Tokens stay server-side. Reference frames and structured
          pacing briefs are sent to a vision model only when rights-attested analysis is enabled.
          Projects and versions remain workspace-private. Publishing to the gallery is a separate
          opt-in action with a user-granted license and moderation.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-ink">Original examples and references</h2>
        <p className="mt-3 leading-relaxed">
          Official prompt briefs and illustrative scenes are authored by Vidrial. They are not
          advertised as outputs from a named model. This approach learns from open-source seek-based
          animation tools; attribution and applicable license notices are recorded in
          THIRD_PARTY_NOTICES.md. Claude is a name used to describe compatibility; Vidrial is not
          affiliated with Anthropic.
        </p>
        <Link
          to="/blog/$slug"
          params={{ slug: "claude-motion-graphics" }}
          className="mt-4 inline-block min-h-11 py-3 underline"
        >
          Read the worked prompt guide
        </Link>
      </section>
    </article>
  ),
});
