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
