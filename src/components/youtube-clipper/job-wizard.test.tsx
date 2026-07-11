import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/services/youtube/server", () => ({ getYouTubeMetadata: vi.fn() }));
vi.mock("@/services/clipping/server", () => ({ createClipJob: vi.fn() }));
vi.mock("./source-upload", () => ({ SourceUpload: () => <div>Mock upload</div> }));
import { JobWizard } from "./job-wizard";
describe("job wizard", () => {
  it("requires the rights checkbox before review", () => {
    render(<JobWizard initialSource="upload" />);
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(screen.getByText(/I own this content or have permission/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(screen.getByRole("alert")).toHaveTextContent("Confirm your rights");
  });
});
