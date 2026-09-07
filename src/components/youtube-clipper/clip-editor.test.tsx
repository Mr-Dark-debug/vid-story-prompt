import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultEditManifest } from "@/domain/clipping/edit-manifest";
vi.mock("@tanstack/react-router", () => ({ useRouter: () => ({ invalidate: vi.fn() }) }));
vi.mock("@/services/clipping/server", () => ({
  saveClipVersion: vi.fn(),
  restoreClipVersion: vi.fn(),
  regenerateClipTitle: vi.fn(),
}));
vi.mock("@/services/exports/server", () => ({ requestClipExport: vi.fn() }));
import { ClipEditor } from "./clip-editor";

afterEach(cleanup);
describe("Exact Cut edit allowance presentation", () => {
  it("explains additional minutes before saving a longer range", () => {
    const manifest = defaultEditManifest({
      durationSeconds: 10,
      title: "A selected range",
      text: "",
    });
    render(
      <ClipEditor
        data={
          {
            clip: { id: "clip", title: "A selected range", duration_seconds: 10 },
            job: { source_duration_seconds: 600 },
            candidate: null,
            previewUrl: null,
            versions: [
              {
                id: "version",
                version_number: 1,
                edit_manifest_json: manifest,
                created_at: "2026-09-07T00:00:00Z",
              },
            ],
            processedSecondsAllowance: 10,
            titleRegenerationAvailable: false,
          } as never
        }
      />,
    );
    expect(screen.getByText(/Shortening or restoring within this duration/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("spinbutton", { name: "End" }), {
      target: { value: "15" },
    });
    expect(screen.getByText(/uses 5 additional processing seconds/)).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "End" })).toHaveAttribute("max", "600");
  });
});
