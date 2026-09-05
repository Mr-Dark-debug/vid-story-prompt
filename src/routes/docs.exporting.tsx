import { createFileRoute } from "@tanstack/react-router";
import { pageMeta } from "@/config/seo";
const sections = [
  [
    "Review the clip",
    "Check the selected boundaries, captions and framing. Clip settings apply to the selected short clip, not a multi-track video project.",
  ],
  [
    "Respect plan limits",
    "The server enforces export resolution, frame rate and watermark requirements. Choosing settings in the browser cannot override your subscription.",
  ],
  [
    "Wait for the render",
    "Exports are asynchronous. Keep following the job until the file is ready; a queued export is not yet downloadable.",
  ],
  [
    "Save a local copy",
    "Use the ready download link before it expires. Request a fresh link if needed while the media is retained. Download before the retention date shown in your workspace.",
  ],
];
export const Route = createFileRoute("/docs/exporting")({
  head: () =>
    pageMeta({
      title: "Export your clips — Vidrial Documentation",
      description: "Preview a clip, confirm its settings and request a downloadable render.",
      path: "/docs/exporting",
    }),
  component: () => (
    <article className="max-w-none text-ink-soft">
      <h1 className="font-display text-3xl text-ink">Export your clips</h1>
      <p className="mt-4">
        Preview a clip, confirm its settings and request a downloadable render.
      </p>
      {sections.map(([heading, body]) => (
        <section key={heading} className="mt-8">
          <h2 className="font-display text-xl text-ink">{heading}</h2>
          <p className="mt-3 leading-relaxed">{body}</p>
        </section>
      ))}
    </article>
  ),
});
