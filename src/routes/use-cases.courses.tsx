import { createFileRoute } from "@tanstack/react-router";
import { UseCaseTemplate } from "@/components/marketing/use-case-template";

export const Route = createFileRoute("/use-cases/courses")({
  head: () => ({
    meta: [{ title: "For online courses — Vidrial" }, { name: "description", content: "Lessons that stay clear and consistent." }, { property: "og:url", content: "/use-cases/courses" }],
    links: [{ rel: "canonical", href: "/use-cases/courses" }],
  }),
  component: () => (
    <UseCaseTemplate
      eyebrow="Courses"
      title="Lessons that stay clear, week after week."
      lead="Consistent captions, chaptering and pacing across an entire course."
      scenario={<>You're producing a 12-lesson course. Each lesson is 8-15 minutes. Consistency matters more than novelty.</>}
      prompts={[
        "For each lesson: remove filler, keep pauses over 200 ms for teaching effect, add chapter markers.",
        "Apply the Course Captions preset with locked 24pt sizing.",
      ]}
      outcomes={["Consistent visual language", "Uniform captions and chapters", "Faster turnaround per lesson"]}
    />
  ),
});
