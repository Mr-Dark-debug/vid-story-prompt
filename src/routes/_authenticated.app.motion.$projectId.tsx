import { createFileRoute } from "@tanstack/react-router";
import { getMotionProject, getMotionCapabilities } from "@/services/motion/server";
import { MotionProjectEditor } from "@/components/motion/motion-project-editor";
import { listWorkspaceUploads } from "@/services/projects/server";

export const Route = createFileRoute("/_authenticated/app/motion/$projectId")({
  head: () => ({ meta: [{ title: "Motion project — Vidrial" }] }),
  loader: async ({ params }) => {
    const capabilities = await getMotionCapabilities();
    const [detail, uploads] = await Promise.all([
      getMotionProject({ data: { projectId: params.projectId } }),
      capabilities.referenceEnabled ? listWorkspaceUploads() : Promise.resolve([]),
    ]);
    return { detail, capabilities, uploads };
  },
  component: MotionProjectPage,
});
function MotionProjectPage() {
  const data = Route.useLoaderData();
  return (
    <MotionProjectEditor
      detail={data.detail}
      capabilities={data.capabilities}
      uploads={data.uploads}
    />
  );
}
