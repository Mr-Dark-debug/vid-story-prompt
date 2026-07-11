import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/services/storage/server", () => ({
  prepareSourceUpload: vi.fn(),
  completeSourceUpload: vi.fn(),
}));
vi.mock("@/services/storage/resumable-upload", () => ({ startResumableUpload: vi.fn() }));
import { SourceUpload } from "./source-upload";
describe("source upload", () => {
  it("advertises accepted sources and resumable boundary", () => {
    render(<SourceUpload onUploaded={vi.fn()} />);
    expect(screen.getByText("Choose the authorised original")).toBeInTheDocument();
    expect(screen.getByText(/MP4, MOV, MKV, WebM or M4V/)).toBeInTheDocument();
  });
});
