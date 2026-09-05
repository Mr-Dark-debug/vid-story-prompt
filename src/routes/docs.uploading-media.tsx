import { createFileRoute } from "@tanstack/react-router";
import { pageMeta } from "@/config/seo";
const sections = [
  [
    "Choose a video",
    "Use a supported video file and check the size and duration limits shown by the upload flow. An original MP4 is a practical source for clipping.",
  ],
  [
    "Keep the upload page open",
    "Wait until the upload is confirmed before starting analysis. A file selection is not a completed upload; failures should be retried from the source step.",
  ],
  [
    "Check your rights",
    "Only process content you own or have permission to use. Uploaded files are private workspace media, not a public hosting service.",
  ],
  [
    "YouTube acquisition is separate",
    "Account connection lists authorised channel content through the YouTube Data API. It cannot fix a download blocked by YouTube's network checks. Uploading your original file avoids that acquisition step.",
  ],
];
export const Route = createFileRoute("/docs/uploading-media")({
  head: () =>
    pageMeta({
      title: "Upload a source video — Vidrial Documentation",
      description: "Use the Upload tab in a new clipping job for your original media.",
      path: "/docs/uploading-media",
    }),
  component: () => (
    <article className="max-w-none text-ink-soft">
      <h1 className="font-display text-3xl text-ink">Upload a source video</h1>
      <p className="mt-4">Use the Upload tab in a new clipping job for your original media.</p>
      {sections.map(([heading, body]) => (
        <section key={heading} className="mt-8">
          <h2 className="font-display text-xl text-ink">{heading}</h2>
          <p className="mt-3 leading-relaxed">{body}</p>
        </section>
      ))}
    </article>
  ),
});
