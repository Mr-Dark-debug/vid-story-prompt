import type {
  getMotionProject as productionDetail,
  getMotionCapabilities as productionCapabilities,
  getMotionUsage as productionUsage,
} from "../../src/services/motion/server";
import { PLAN_ENTITLEMENTS } from "../../src/domain/clipping/entitlements";
import { lintMotionHtml } from "../../src/domain/motion/lint";
type Detail = Awaited<ReturnType<typeof productionDetail>>;
export const capabilities: Awaited<ReturnType<typeof productionCapabilities>> = {
  availability: "beta",
  generationEnabled: true,
  renderEnabled: true,
  referenceEnabled: false,
  models: [{ id: "labelled-fixture-model", label: "Mocked model boundary", supportsVision: false }],
  reason: undefined,
};
export const usage: Awaited<ReturnType<typeof productionUsage>> = {
  plan: "free",
  entitlement: PLAN_ENTITLEMENTS.free,
  limitSeconds: 120,
  reservedSeconds: 0,
  committedSeconds: 0,
};
const createdAt = "2026-10-03T00:00:00Z";
export const source = `<!doctype html><html><body style="margin:0;background:#1d1d1b;color:white"><canvas id="c" width="1280" height="720"></canvas><script>window.DURATION=8;window.seek=async function(t){const g=document.getElementById('c').getContext('2d');g.fillStyle='#1d1d1b';g.fillRect(0,0,1280,720);g.fillStyle='#ef8668';g.fillRect(100+t*40,200,180,180);};</script></body></html>`;
const detail: Detail = {
  project: {
    id: "00000000-0000-4000-8000-000000000001",
    workspaceId: "00000000-0000-4000-8000-000000000002",
    userId: "00000000-0000-4000-8000-000000000003",
    title: "Original fixture",
    prompt: "An original motion story",
    modelId: "labelled-fixture-model",
    status: "draft",
    renderSpec: { width: 1280, height: 720, aspect: "16:9", durationSeconds: 8, fps: 30 },
    createdAt,
    updatedAt: createdAt,
  },
  versions: [],
  renders: [],
  tasks: [],
  referenceAnalyses: [],
};
export function snapshot() {
  return structuredClone(detail);
}
export async function getMotionProject() {
  return snapshot();
}
export async function getMotionCapabilities() {
  return capabilities;
}
export async function getMotionUsage() {
  return usage;
}
export async function createMotionProject({
  data,
}: {
  data: {
    title: string;
    prompt: string;
    modelId: string;
    renderSpec: Detail["project"]["renderSpec"];
  };
}) {
  detail.project = { ...detail.project, ...data, prompt: data.prompt };
  return { projectId: detail.project.id };
}
export async function generateMotionVersion() {
  const id = crypto.randomUUID();
  detail.versions.unshift({
    id,
    projectId: detail.project.id,
    htmlSource: source,
    contentHash: "labelled-fixture-hash",
    lintReport: lintMotionHtml(source),
    modelUsed: "labelled-fixture-model",
    tokensUsed: 0,
    parentVersionId: detail.versions[0]?.id ?? null,
    createdAt,
    critiqueReport: null,
  });
  detail.project.status = "preview_ready";
  return { taskId: crypto.randomUUID() };
}
export async function saveMotionVersion({ data }: { data: { htmlSource: string } }) {
  const id = crypto.randomUUID();
  detail.versions.unshift({
    ...detail.versions[0],
    id,
    htmlSource: data.htmlSource,
    lintReport: lintMotionHtml(data.htmlSource),
  });
  return { versionId: id };
}
export async function requestMotionRender() {
  detail.renders.unshift({
    id: crypto.randomUUID(),
    projectId: detail.project.id,
    versionId: detail.versions[0].id,
    status: "ready",
    progress: 1,
    outputUrl: "/motion-demos/a-small-start.mp4",
    watermarked: true,
    errorCode: null,
    createdAt,
  });
  return { taskId: crypto.randomUUID() };
}
export async function cancelMotionTask() {
  return { cancelled: true };
}
export async function analyzeMotionReference() {
  throw new Error("Reference is not enabled in this fixture");
}
export const authService = { signOut: async () => undefined };
export const useSession = () => ({
  id: detail.project.userId,
  workspaceId: detail.project.workspaceId,
  email: "fixture@example.test",
  displayName: "Labelled fixture",
});
export const getSupabaseBrowserClient = () => {
  throw new Error("Realtime is explicitly not mocked as live");
};
