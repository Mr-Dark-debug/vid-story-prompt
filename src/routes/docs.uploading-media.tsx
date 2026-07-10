import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/docs/uploading-media")({
  head: () => ({
    meta: [{ title: "Uploading media — Vidrial docs" }, { name: "description", content: "Supported formats, folder uploads and roles." }, { property: "og:url", content: "/docs/uploading-media" }],
    links: [{ rel: "canonical", href: "/docs/uploading-media" }],
  }),
  component: () => (
    <article className="prose max-w-none text-ink-soft">
      <h1 className="font-display text-3xl text-ink">Uploading media</h1>
      <p className="mt-2">Vidrial accepts video, audio, images, subtitle files and text documents.</p>
      <h2 className="mt-6 font-display text-xl text-ink">Formats</h2>
      <ul className="mt-2 list-disc pl-5">
        <li>Video — .mp4, .mov, .mkv, .webm</li>
        <li>Audio — .wav, .mp3, .m4a, .flac</li>
        <li>Images — .jpg, .png, .webp</li>
        <li>Subtitles — .srt, .vtt</li>
        <li>Text — .md, .txt</li>
      </ul>
      <h2 className="mt-6 font-display text-xl text-ink">Roles</h2>
      <p>Assign roles (A-roll, B-roll, music, voiceover, image, reference, exclude) so the AI knows what to reach for.</p>
    </article>
  ),
});
