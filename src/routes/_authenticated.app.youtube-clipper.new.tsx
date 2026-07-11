import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { AppPageHeader } from "@/components/app/layout";
import { JobWizard } from "@/components/youtube-clipper/job-wizard";
export const Route = createFileRoute("/_authenticated/app/youtube-clipper/new")({ validateSearch: z.object({ youtube: z.string().optional(), source: z.string().optional() }), component: NewClipJob });
function NewClipJob() { const search = Route.useSearch(); return <div className="mx-auto max-w-4xl"><AppPageHeader eyebrow="YouTube Clipper" title="Create a clipping job" description="You stay in control of the source, the selected moments and every edit." /><JobWizard initialYoutube={search.youtube} initialSource={search.source} /></div>; }
