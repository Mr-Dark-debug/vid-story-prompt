import { createFileRoute } from "@tanstack/react-router";
import { UseCaseTemplate } from "@/components/marketing/use-case-template";
import { pageMeta } from "@/config/seo";

export const Route = createFileRoute("/use-cases/courses")({
  head: () =>
    pageMeta({
      title: "AI Video Editing for Online Courses — Vidrial",
      description:
        "Create consistent online-course lessons with reviewable editing, pacing, captions, chapters and repeatable export settings.",
      path: "/use-cases/courses",
    }),
  component: () => (
    <UseCaseTemplate
      eyebrow="Courses"
      title="Lessons that stay clear, week after week."
      lead="Consistent captions, chaptering and pacing across an entire course."
      scenario={
        <>
          You're producing a 12-lesson course. Each lesson is 8-15 minutes. Consistency matters more
          than novelty.
        </>
      }
      prompts={[
        "For each lesson: remove filler, keep pauses over 200 ms for teaching effect, add chapter markers.",
        "Apply the Course Captions preset with locked 24pt sizing.",
      ]}
      outcomes={[
        "Consistent visual language",
        "Uniform captions and chapters",
        "Faster turnaround per lesson",
      ]}
    />
  ),
});
