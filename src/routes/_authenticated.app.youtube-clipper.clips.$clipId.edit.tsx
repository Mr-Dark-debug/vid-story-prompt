import { createFileRoute } from "@tanstack/react-router";
import { ClipEditor } from "@/components/youtube-clipper/clip-editor";
import { getClipForEditor } from "@/services/clipping/server";

export const Route = createFileRoute("/_authenticated/app/youtube-clipper/clips/$clipId/edit")({
  loader: ({ params }) => getClipForEditor({ data: { clipId: params.clipId } }),
  component: ClipEditorRoute,
});

function ClipEditorRoute() {
  return <ClipEditor data={Route.useLoaderData()} />;
}
