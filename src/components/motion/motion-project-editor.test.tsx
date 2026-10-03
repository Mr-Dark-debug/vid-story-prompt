import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MotionProjectEditor } from "./motion-project-editor";
import { generateMotionVersion, getMotionProject } from "@/services/motion/server";
const invalidate = vi.fn().mockResolvedValue(undefined);
vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ invalidate }),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock("./motion-preview", () => ({
  MotionPreview: () => <div>Explicitly mocked preview boundary</div>,
}));
vi.mock("@/services/motion/server", () => ({
  generateMotionVersion: vi.fn(),
  saveMotionVersion: vi.fn(),
  requestMotionRender: vi.fn(),
  cancelMotionTask: vi.fn(),
  analyzeMotionReference: vi.fn(),
  getMotionProject: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});
const capabilities = {
  availability: "beta" as const,
  generationEnabled: true,
  renderEnabled: true,
  referenceEnabled: true,
  models: [{ id: "configured-model", label: "Configured model", supportsVision: true }],
  reason: undefined,
};
const brief = {
  pacing: "measured" as const,
  cutsPerSecond: 0.5,
  palette: ["#123456"],
  typography: "Readable labels",
  transitionTypes: ["shape morph"],
  beatTimings: [0, 2, 4],
  principles: ["Give each idea space"],
};
const createdAt = "2026-10-03T00:00:00Z";
const detail: Awaited<ReturnType<typeof getMotionProject>> = {
  project: {
    id: "project",
    userId: "user",
    workspaceId: "workspace",
    title: "An original scene",
    prompt: "An original brief",
    modelId: "configured-model",
    status: "draft",
    renderSpec: { width: 1280, height: 720, aspect: "16:9", durationSeconds: 8, fps: 30 },
    createdAt,
    updatedAt: createdAt,
  },
  versions: [],
  renders: [],
  tasks: [],
  referenceAnalyses: [
    {
      id: "analysis",
      mediaAssetId: "media",
      status: "queued",
      brief: null,
      modelUsed: null,
      errorCode: null,
      createdAt,
    },
  ],
};
describe("MotionProjectEditor reference and critique gates", () => {
  it("refreshes an expired download URL at an explicitly mocked signed URL service boundary", async () => {
    const output = {
      id: "render",
      projectId: "project",
      versionId: "version",
      status: "ready",
      progress: 1,
      outputUrl: "https://example.test/stale",
      watermarked: true,
      errorCode: null,
      createdAt,
    };
    vi.mocked(getMotionProject).mockResolvedValue({
      ...detail,
      renders: [{ ...output, outputUrl: "https://example.test/fresh" }],
    });
    let clickedUrl = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clickedUrl = this.href;
    });
    render(
      <MotionProjectEditor detail={{ ...detail, renders: [output] }} capabilities={capabilities} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Download MP4" }));
    await waitFor(() => expect(clickedUrl).toBe("https://example.test/fresh"));
    expect(getMotionProject).toHaveBeenCalledWith({ data: { projectId: "project" } });
    expect(screen.getByText(/Download requested using a fresh signed URL/)).toBeInTheDocument();
  });
  it("keeps generation disabled while the latest reference brief is not ready", () => {
    render(<MotionProjectEditor detail={detail} capabilities={capabilities} />);
    expect(screen.getByRole("button", { name: "Generate from brief" })).toBeDisabled();
    expect(
      screen.getByText(/Generation waits until the motion brief is ready/),
    ).toBeInTheDocument();
    expect(generateMotionVersion).not.toHaveBeenCalled();
  });
  it("allows generation after a valid reference result at an explicitly mocked model boundary", async () => {
    vi.mocked(generateMotionVersion).mockResolvedValue({ taskId: "mock-task" });
    render(
      <MotionProjectEditor
        detail={{
          ...detail,
          referenceAnalyses: [
            { ...detail.referenceAnalyses[0], status: "ready", brief, modelUsed: "vision-model" },
          ],
        }}
        capabilities={capabilities}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Generate from brief" }));
    await waitFor(() => expect(generateMotionVersion).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("region", { name: "Analysed motion brief" })).toHaveTextContent(
      "vision-model",
    );
  });
  it("shows actual saved critique findings as escaped text", () => {
    const { container } = render(
      <MotionProjectEditor
        detail={{
          ...detail,
          referenceAnalyses: [],
          versions: [
            {
              id: "version",
              projectId: "project",
              htmlSource:
                "<html><body><script>window.DURATION = 8; window.seek = async function(t) {};</script></body></html>",
              contentHash: "hash",
              lintReport: { ok: true, errors: [], warnings: [] },
              modelUsed: "configured-model",
              tokensUsed: 12,
              parentVersionId: null,
              createdAt,
              critiqueReport: {
                rounds: 2,
                resolved: false,
                issues: [
                  { code: "contrast", description: '<img src="untrusted"> needs better contrast' },
                ],
              },
            },
          ],
        }}
        capabilities={capabilities}
      />,
    );
    expect(screen.getByText(/2 critique rounds/)).toHaveTextContent("review the remaining issues");
    expect(screen.getByText('<img src="untrusted"> needs better contrast')).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });
});
