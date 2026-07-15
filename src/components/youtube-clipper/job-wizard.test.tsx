import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/services/youtube/server", () => ({ getYouTubeMetadata: vi.fn() }));
vi.mock("@/services/clipping/server", () => ({ createClipJob: vi.fn() }));
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

afterEach(() => cleanup());

describe("job wizard", () => {
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
    expect(screen.getByText("1.2M")).toBeInTheDocument();
    expect(screen.getByText("HD · 2D")).toBeInTheDocument();
  });
});
