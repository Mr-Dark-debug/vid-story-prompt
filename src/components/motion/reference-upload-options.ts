import type { listWorkspaceUploads } from "@/services/projects/server";
export type MotionReferenceUploads = Awaited<ReturnType<typeof listWorkspaceUploads>>;
export function eligibleMotionReferenceUploads(uploads: MotionReferenceUploads) {
  return uploads.filter(
    (item) =>
      ["ready", "uploaded"].includes(item.status) &&
      ["video/mp4", "video/webm", "video/quicktime"].includes(item.mime_type ?? "") &&
      Number(item.duration_seconds) >= 1 &&
      Number(item.duration_seconds) <= 60 &&
      Number(item.size_bytes) > 0 &&
      Number(item.size_bytes) <= 50 * 1024 * 1024,
  );
}
