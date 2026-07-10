import { createFileRoute } from "@tanstack/react-router";
import { UseCaseTemplate } from "@/components/marketing/use-case-template";

export const Route = createFileRoute("/use-cases/product-demos")({
  head: () => ({
    meta: [{ title: "For product demos — Vidrial" }, { name: "description", content: "A tight demo from screen and camera." }, { property: "og:url", content: "/use-cases/product-demos" }],
    links: [{ rel: "canonical", href: "/use-cases/product-demos" }],
  }),
  component: () => (
    <UseCaseTemplate
      eyebrow="Product demos"
      title="A demo people actually finish."
      lead="Screen capture and camera brought together into a tight, honest walkthrough."
      scenario={<>You have 25 minutes of screen recording and a talking head. You need a 3-minute demo for the homepage.</>}
      prompts={[
        "Draft a 3-minute demo. Prefer the passages where I explain the outcome, not the setup.",
        "Cut to the screen when I say \"here's how\". Cut back to camera at the summary.",
      ]}
      outcomes={["Tight 3-minute cut", "Screen ↔ camera cadence handled", "A longer 8-minute version saved as a variant"]}
    />
  ),
});
