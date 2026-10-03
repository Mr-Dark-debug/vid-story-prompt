import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { eligibleMotionReferenceUploads } from "./reference-upload-options";
import { MotionReferenceResult } from "./motion-reference-result";
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
afterEach(cleanup);
const asset = {
  id: "source",
  project_id: null,
  display_name: "A source",
  mime_type: "video/mp4",
  size_bytes: 1000,
  duration_seconds: 5,
  status: "ready",
  created_at: "2026-10-03T00:00:00Z",
};
describe("Motion references", () => {
  it("excludes incomplete, nonvideo, oversized and overlong references", () => {
    expect(
      eligibleMotionReferenceUploads([
        asset,
        { ...asset, id: "pending", status: "uploading" },
        { ...asset, id: "audio", mime_type: "audio/mp4" },
        { ...asset, id: "huge", size_bytes: 51 * 1024 * 1024 },
        { ...asset, id: "long", duration_seconds: 61 },
      ]).map((item) => item.id),
    ).toEqual(["source"]);
  });
  it("shows durable analysis failure without inventing a brief", () => {
    render(
      <MotionReferenceResult
        analysis={{
          id: "reference",
          status: "failed",
          brief: null,
          modelUsed: null,
          errorCode: "vision_provider_unavailable",
          createdAt: asset.created_at,
        }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("vision provider unavailable");
    expect(screen.queryByRole("region", { name: "Analysed motion brief" })).toBeNull();
  });
  it("displays only validated motion principles and actual model provenance", () => {
    render(
      <MotionReferenceResult
        analysis={{
          id: "reference",
          status: "ready",
          modelUsed: "configured-vision-model",
          errorCode: null,
          createdAt: asset.created_at,
          brief: {
            pacing: "measured",
            cutsPerSecond: 0.5,
            palette: ["#123456"],
            typography: "Readable labels",
            transitionTypes: ["shape morph"],
            beatTimings: [0, 2, 4],
            principles: ["Give each idea space"],
          },
        }}
      />,
    );
    expect(screen.getByRole("region", { name: "Analysed motion brief" })).toHaveTextContent(
      "configured-vision-model",
    );
    expect(screen.getByText("Give each idea space")).toBeInTheDocument();
  });
  it("blocks a malformed ready result", () => {
    render(
      <MotionReferenceResult
        analysis={{
          id: "reference",
          status: "ready",
          brief: { pacing: "fast" },
          modelUsed: null,
          errorCode: null,
          createdAt: asset.created_at,
        }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("invalid");
  });
});
