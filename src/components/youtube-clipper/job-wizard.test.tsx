import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/services/youtube/server", () => ({ getYouTubeMetadata: vi.fn() }));
vi.mock("@/services/clipping/server", () => ({ createClipJob: vi.fn() }));
vi.mock("@/services/analytics/client", () => ({ trackAnalyticsEvent: vi.fn() }));
vi.mock("@/services/worker/server", () => ({
  getWorkerEgressHealth: vi.fn().mockResolvedValue({
    checkedAt: "2026-07-18T21:00:00.000Z",
    message: "Automatic source access is available.",
    status: "healthy",
  }),
}));
vi.mock("./source-upload", () => ({
  SourceUpload: ({ onUploaded }: { onUploaded: (source: unknown) => void }) => (
    <button
      type="button"
      onClick={() =>
        onUploaded({
          assetId: "11111111-1111-4111-8111-111111111111",
          filename: "video.mp4",
          durationSeconds: 120,
        })
      }
    >
      Complete mock upload
    </button>
  ),
}));

import { getYouTubeMetadata } from "@/services/youtube/server";
import { JobWizard } from "./job-wizard";
import { createClipJob } from "@/services/clipping/server";
import { PLAN_ENTITLEMENTS } from "@/domain/clipping/entitlements";

afterEach(() => cleanup());

describe("job wizard", () => {
  it("submits five Exact Cut ranges while charging the selected duration in the quota preview", async () => {
    vi.mocked(createClipJob).mockResolvedValueOnce({
      jobId: "11111111-1111-4111-8111-111111111111",
      workerWake: "accepted",
    });
    render(
      <JobWizard
        initialSource="upload"
        creationContext={{
          plan: "free",
          entitlement: PLAN_ENTITLEMENTS.free,
          activeJobs: 0,
          reservedSeconds: 3540,
          committedSeconds: 0,
          exactCutAvailable: true,
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Complete mock upload" }));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(await screen.findByRole("radio", { name: "I already know my clips" }));
    fireEvent.change(screen.getByLabelText("Paste timestamp ranges"), {
      target: { value: "0-10,10-20,20-30,30-40,40-50" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add pasted ranges" }));
    fireEvent.change(screen.getByLabelText("End for clip 1"), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("52 selected-range seconds")).toBeInTheDocument();
    expect(screen.getByText("Off — no transcription or AI planning")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create clipping job" }));
    await waitFor(() =>
      expect(createClipJob).toHaveBeenCalledWith({
        data: expect.objectContaining({
          rightsAccepted: true,
          requestedClipCount: 5,
          sourceDurationSeconds: 120,
          settings: {
            mode: "manual_timestamp",
            captionsRequested: false,
            ranges: [
              { startSeconds: 0, endSeconds: 12 },
              { startSeconds: 10, endSeconds: 20 },
              { startSeconds: 20, endSeconds: 30 },
              { startSeconds: 30, endSeconds: 40 },
              { startSeconds: 40, endSeconds: 50 },
            ],
          },
        }),
      }),
    );
  });
  it("blocks an over-limit range batch before review", async () => {
    render(
      <JobWizard
        initialSource="upload"
        creationContext={{
          plan: "free",
          entitlement: PLAN_ENTITLEMENTS.free,
          activeJobs: 0,
          reservedSeconds: 0,
          committedSeconds: 0,
          exactCutAvailable: true,
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Complete mock upload" }));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(await screen.findByRole("radio", { name: "I already know my clips" }));
    fireEvent.change(screen.getByLabelText("Paste timestamp ranges"), {
      target: { value: "0-10,10-20,20-30,30-40,40-50,50-60" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add pasted ranges" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("alert")).toHaveTextContent("up to 5 clips");
    expect(
      screen.queryByRole("heading", { name: "Review the clipping job" }),
    ).not.toBeInTheDocument();
  });
  const chooseSource = (name: string) => {
    fireEvent.click(screen.getByRole("button", { name: "Choose video source" }));
    fireEvent.change(screen.getByLabelText("Search sources"), { target: { value: name } });
    fireEvent.click(screen.getByRole("button", { name: new RegExp(name, "i") }));
  };

  it("keeps rights confirmation in the source step", async () => {
    render(<JobWizard initialSource="upload" />);

    expect(screen.getByText(/I own this content or have permission/)).toBeInTheDocument();
    expect(screen.queryByText("Rights & source")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Complete mock upload" }));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(screen.getByRole("alert")).toHaveTextContent("Confirm your rights");

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(await screen.findByRole("heading", { name: "Clip preferences" })).toBeInTheDocument();
  });

  it("uses a tier-aware clip dropdown instead of a numeric input", async () => {
    render(<JobWizard initialSource="upload" />);

    fireEvent.click(screen.getByRole("button", { name: "Complete mock upload" }));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    const picker = await screen.findByRole("combobox", { name: "Requested clips" });
    expect(picker).toHaveTextContent("5 clips");
    expect(screen.getByText(/Free includes up to 5 clips per job/)).toBeInTheDocument();
    expect(screen.queryByRole("spinbutton", { name: "Requested clips" })).not.toBeInTheDocument();
  });

  it("retrieves YouTube details through Continue without CAPTCHA or OAuth", async () => {
    vi.mocked(getYouTubeMetadata).mockResolvedValue({
      videoId: "dQw4w9WgXcQ",
      title: "A useful video",
      channelId: "channel-id",
      channelTitle: "Example channel",
      publishedAt: "2025-01-01T00:00:00Z",
      durationSeconds: 180,
      thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      viewCount: "1200000",
      likeCount: "45000",
      definition: "hd",
      dimension: "2d",
      availability: "public",
      embeddable: true,
      ownership: "unknown",
    });

    render(<JobWizard />);
    fireEvent.change(screen.getByLabelText("YouTube video link"), {
      target: { value: "https://youtube.com/watch?v=dQw4w9WgXcQ" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    expect(screen.queryByRole("button", { name: /retrieve details/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/security verification/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/connect youtube/i)).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("A useful video")).toBeInTheDocument());
    expect(screen.getByAltText("Thumbnail for A useful video")).toHaveAttribute(
      "src",
      "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    );
    expect(screen.queryByText("1.2M")).not.toBeInTheDocument();
    expect(screen.queryByText(/ready for secure worker import/i)).not.toBeInTheDocument();
  });

  it("continues from an attested YouTube URL without a local upload", async () => {
    vi.mocked(getYouTubeMetadata).mockResolvedValue({
      videoId: "dQw4w9WgXcQ",
      title: "Worker acquisition source",
      channelId: "channel-id",
      channelTitle: "Example channel",
      publishedAt: "2025-01-01T00:00:00Z",
      durationSeconds: 180,
      thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      viewCount: "1200000",
      likeCount: "45000",
      definition: "hd",
      dimension: "2d",
      availability: "public",
      embeddable: true,
      ownership: "unknown",
    });

    render(<JobWizard />);
    fireEvent.change(screen.getByLabelText("YouTube video link"), {
      target: { value: "https://youtube.com/watch?v=dQw4w9WgXcQ" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    expect(await screen.findByRole("heading", { name: "Clip preferences" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Complete mock upload" })).not.toBeInTheDocument();
  });

  it("keeps the YouTube fields on the single wizard surface", () => {
    render(<JobWizard />);
    expect(screen.getAllByTestId("wizard-step-surface")).toHaveLength(1);
    expect(screen.getByTestId("youtube-source-fields")).not.toHaveClass("bg-surface-raised");
  });

  it("surfaces automatic source access in the active YouTube source step", async () => {
    render(<JobWizard />);

    expect(
      await screen.findByRole("status", { name: "Source access: Healthy" }),
    ).toBeInTheDocument();
  });

  it("switches to the selected direct source form without losing the three-step flow", () => {
    render(<JobWizard />);
    chooseSource("Paste media link");
    expect(screen.getByLabelText("Owner-controlled HTTPS media URL")).toBeInTheDocument();
    expect(screen.getByText(/protected downloader/i)).toBeInTheDocument();
    expect(screen.getByText(/I own this content or have permission/)).toBeInTheDocument();
  });

  it("routes a pasted YouTube link to the YouTube connector before retrieval", () => {
    render(<JobWizard />);
    chooseSource("Paste media link");

    fireEvent.change(screen.getByLabelText("Owner-controlled HTTPS media URL"), {
      target: { value: "https://youtu.be/dQw4w9WgXcQ" },
    });

    expect(screen.getByLabelText("YouTube video link")).toHaveValue("https://youtu.be/dQw4w9WgXcQ");
  });
});
