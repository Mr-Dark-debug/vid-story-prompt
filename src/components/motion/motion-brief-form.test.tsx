import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PLAN_ENTITLEMENTS } from "@/domain/clipping/entitlements";
import { MotionBriefForm } from "./motion-brief-form";
import {
  analyzeMotionReference,
  createMotionProject,
  generateMotionVersion,
} from "@/services/motion/server";

const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock("@/services/motion/server", () => ({
  createMotionProject: vi.fn(),
  generateMotionVersion: vi.fn(),
  analyzeMotionReference: vi.fn(),
}));
vi.mock("@/services/motion/draft", () => ({
  readMotionDraft: () => null,
  clearMotionDraft: vi.fn(),
}));
const usage = {
  plan: "free" as const,
  limitSeconds: 120,
  reservedSeconds: 0,
  committedSeconds: 0,
  entitlement: PLAN_ENTITLEMENTS.free,
};
const capabilities = {
  availability: "beta" as const,
  generationEnabled: false as const,
  renderEnabled: false as const,
  referenceEnabled: false as const,
  models: [],
  reason: undefined,
};
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createMotionProject).mockResolvedValue({ projectId: "project-id" });
});
describe("MotionBriefForm", () => {
  it("requires rights before reference analysis and waits to generate until the saved analysis is ready", async () => {
    vi.mocked(analyzeMotionReference)
      .mockRejectedValueOnce(new Error("Worker unavailable"))
      .mockResolvedValueOnce({ taskId: "task-id", referenceId: "analysis-id" });
    render(
      <MotionBriefForm
        capabilities={{
          ...capabilities,
          generationEnabled: true,
          referenceEnabled: true,
          models: [{ id: "configured-model", label: "Configured model", supportsVision: true }],
        }}
        usage={usage}
        uploads={[
          {
            id: "reference-id",
            project_id: null,
            display_name: "Original reference",
            mime_type: "video/mp4",
            size_bytes: 1000,
            duration_seconds: 5,
            status: "uploaded",
            created_at: "2026-10-03T00:00:00Z",
          },
        ]}
      />,
    );
    fireEvent.change(screen.getByLabelText("Your motion brief"), {
      target: { value: "An original brief with exact words." },
    });
    fireEvent.change(screen.getByLabelText("Workspace reference video"), {
      target: { value: "reference-id" },
    });
    expect(screen.getByRole("button", { name: "Analyse reference first" })).toBeDisabled();
    expect(analyzeMotionReference).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("checkbox", { name: /I own this content/ }));
    fireEvent.click(screen.getByRole("button", { name: "Analyse reference first" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Worker unavailable"));
    expect(createMotionProject).toHaveBeenCalledTimes(1);
    expect(generateMotionVersion).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Analyse reference first" }));
    await waitFor(() => expect(analyzeMotionReference).toHaveBeenCalledTimes(2));
    const requests = vi.mocked(analyzeMotionReference).mock.calls;
    expect(requests[0][0]).toMatchObject({
      data: { projectId: "project-id", mediaAssetId: "reference-id", rightsAccepted: true },
    });
    expect(requests[1][0]).toEqual(requests[0][0]);
    expect(createMotionProject).toHaveBeenCalledTimes(1);
    expect(generateMotionVersion).not.toHaveBeenCalled();
    await waitFor(() => expect(navigate).toHaveBeenCalled());
  });
  it("allows a manual project without simulating a model call and bounds portrait output to the free plan", async () => {
    render(<MotionBriefForm capabilities={capabilities} usage={usage} />);
    fireEvent.change(screen.getByLabelText("Your motion brief"), {
      target: { value: "An original brief with exact words." },
    });
    fireEvent.change(screen.getByLabelText("Aspect ratio"), { target: { value: "9:16" } });
    expect(screen.getByLabelText("Frames per second")).not.toHaveTextContent("60");
    fireEvent.click(screen.getByRole("button", { name: "Create a code project" }));
    await waitFor(() => expect(createMotionProject).toHaveBeenCalledTimes(1));
    expect(vi.mocked(createMotionProject).mock.calls[0][0]).toMatchObject({
      data: {
        modelId: "manual",
        renderSpec: { width: 720, height: 1280, fps: 30, aspect: "9:16" },
      },
    });
    expect(generateMotionVersion).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: "/app/motion/$projectId",
        params: { projectId: "project-id" },
      }),
    );
  });
  it("keeps generation non-executable when the deployment is not configured", () => {
    render(
      <MotionBriefForm
        capabilities={{
          ...capabilities,
          availability: "coming_soon",
          reason: "Motion Studio is not configured on this deployment.",
        }}
        usage={usage}
      />,
    );
    expect(screen.getByRole("button", { name: "Create a code project" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add a reference" })).toBeDisabled();
  });
});
