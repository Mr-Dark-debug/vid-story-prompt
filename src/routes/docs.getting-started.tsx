import { createFileRoute } from "@tanstack/react-router";
import { pageMeta } from "@/config/seo";
const sections = [
  [
    "1. Add your source",
    "Create an account, open Clipping jobs and choose New clipping job. Upload your original video or paste an eligible YouTube URL. YouTube account connection is optional and does not enable downloading.",
  ],
  [
    "2. Choose settings",
    "Confirm your rights and review the source duration. Choose the clip count, target length, aspect ratio and caption style within your plan limits.",
  ],
  [
    "3. Follow processing",
    "The saved job shows import, analysis and clip-rendering stages. You can return later. If a provider blocks the source, the job explains what failed; it will not show a fake completion.",
  ],
  [
    "4. Review and export",
    "Watch the generated previews. Use Clip settings for captions, boundaries and framing, then request an export. Download finished files before your plan's retention window expires.",
  ],
];
export const Route = createFileRoute("/docs/getting-started")({
  head: () =>
    pageMeta({
      title: "Create your first clips — Vidrial Documentation",
      description: "Start a clipping job with a video you own or are authorised to use.",
      path: "/docs/getting-started",
    }),
  component: () => (
    <article className="max-w-none text-ink-soft">
      <h1 className="font-display text-3xl text-ink">Create your first clips</h1>
      <p className="mt-4">Start a clipping job with a video you own or are authorised to use.</p>
      {sections.map(([heading, body]) => (
        <section key={heading} className="mt-8">
          <h2 className="font-display text-xl text-ink">{heading}</h2>
          <p className="mt-3 leading-relaxed">{body}</p>
        </section>
      ))}
    </article>
  ),
});
