import { createFileRoute } from "@tanstack/react-router";
import { AppPageHeader } from "@/components/app/layout";
import { StatusDot } from "@/components/primitives/status-dot";
import { Sparkles, Youtube, Mic, Smartphone, GraduationCap, MonitorPlay } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/templates")({
  head: () => ({ meta: [{ title: "Templates — Vidrial" }] }),
  component: Templates,
});

const templates = [
  { icon: Youtube, name: "YouTube long-form", body: "Cold open · chapters · sponsor slot · outro." },
  { icon: Mic, name: "Podcast highlights", body: "Two-camera edit, filler removal, waveform captions." },
  { icon: Smartphone, name: "Short-form vertical", body: "9:16 hook · captions · music duck." },
  { icon: GraduationCap, name: "Course lesson", body: "Slides overlay · chapters · quiet-pause trimming." },
  { icon: MonitorPlay, name: "Product demo", body: "Screen focus · zoom-ins · call-to-action." },
  { icon: Sparkles, name: "Blank AI plan", body: "Start with a prompt on any project." },
];

function Templates() {
  return (
    <div>
      <AppPageHeader
        title="Templates"
        description="Starting points that shape the AI editor's first plan. All templates are editable."
        eyebrow="Library"
        actions={<StatusDot variant="demo">Simulated content</StatusDot>}
      />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <li key={t.name} className="rounded-2xl border border-line bg-surface-panel p-5">
            <t.icon className="h-5 w-5 text-ember" />
            <div className="mt-3 font-display text-lg text-ink">{t.name}</div>
            <p className="mt-1 text-sm text-ink-soft">{t.body}</p>
            <button className="mt-4 rounded-md border border-line bg-surface-page px-3 py-1.5 text-sm text-ink">Use template</button>
          </li>
        ))}
      </ul>
    </div>
  );
}