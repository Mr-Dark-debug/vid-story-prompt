import { createFileRoute } from "@tanstack/react-router";
import { SimpleMarketingPage } from "@/components/marketing/simple-page";

export const Route = createFileRoute("/ai-transparency")({
  head: () => ({
    meta: [
      { title: "AI transparency — Vidrial" },
      { name: "description", content: "When AI is used, what it sees, and what stays in your hands." },
      { property: "og:url", content: "/ai-transparency" },
    ],
    links: [{ rel: "canonical", href: "/ai-transparency" }],
  }),
  component: AITransparencyPage,
});

function AITransparencyPage() {
  return (
    <SimpleMarketingPage
      eyebrow="AI transparency"
      title="When AI is used, and when it isn't."
      lead="Vidrial uses AI for analysis and edit planning. We label anything generative. You decide what ships."
    >
      <h3>When AI is used</h3>
      <ul>
        <li>Transcription, speaker labelling and scene detection on your uploads.</li>
        <li>Semantic search of your project.</li>
        <li>Edit-plan proposals in response to your instructions.</li>
        <li>Optional generative operations — voice, music or B-roll — always separately priced and clearly labelled.</li>
      </ul>
      <h3>What the AI sees</h3>
      <p>
        For AI actions, we send the relevant excerpts of your project (transcripts, timeline state, the selection you're
        acting on) to model providers under contracts that prohibit training on that data. Original media isn't sent unless
        necessary for a specific generation step.
      </p>
      <h3>What stays with you</h3>
      <ul>
        <li>Every AI plan is a proposal until you accept it.</li>
        <li>Accept-all, accept-some, edit-any-step and reject are first-class actions.</li>
        <li>Undo and version history apply to AI actions the same way they apply to yours.</li>
      </ul>
      <h3>Generated & materially manipulated media</h3>
      <ul>
        <li>Generated clips carry a visible label in the media library.</li>
        <li>Exports containing synthetic voice or video prompt you to confirm the intended disclosure.</li>
        <li>Provenance metadata is written when the destination format supports it.</li>
        <li>Ordinary silence removal or colour balance is <em>not</em> classified as generation.</li>
      </ul>
      <h3>Reporting harmful output</h3>
      <p>
        Please email <a href="mailto:trust@vidrial.app">trust@vidrial.app</a> with the project ID and a description of the output.
      </p>
    </SimpleMarketingPage>
  );
}
