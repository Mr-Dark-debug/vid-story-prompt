import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps, ReactNode } from "react";

vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ invalidate: vi.fn() }),
  Link: ({ children }: { children: ReactNode }) => <a href="/clip-settings">{children}</a>,
}));
vi.mock("@/services/clipping/server", () => ({ regenerateClipTitle: vi.fn() }));
vi.mock("@/services/exports/server", () => ({ requestBatchExport: vi.fn() }));
import { ResultsGallery } from "./results-gallery";

afterEach(cleanup);
type Candidate = ComponentProps<typeof ResultsGallery>["candidates"][number];
const manual: Candidate = {
  id: "manual",
  origin: "manual_timestamp",
  start_seconds: 30,
  end_seconds: 45,
  title: "My exact moment",
  summary: "",
  standalone_score: null,
  hook_score: null,
  clarity_score: null,
  story_score: null,
  relevance_score: null,
  overall_score: null,
  selection_reason: "",
  social_copy_json: {},
  rank: 1,
};
const ai: Candidate = {
  ...manual,
  id: "ai",
  origin: "ai_discovery",
  title: "Discovered moment",
  standalone_score: 90,
  hook_score: 90,
  clarity_score: 80,
  story_score: 85,
  relevance_score: 75,
  overall_score: 85,
  selection_reason: "A complete thought.",
  rank: 2,
};
const clips = [
  {
    id: "clip",
    clip_candidate_id: "manual",
    current_version_id: "version",
    duration_seconds: 15,
    preview_url: null,
    status: "ready",
  },
];

describe("candidate origin presentation", () => {
  it("does not invent a zero score or planner explanation for Exact Cut", () => {
    render(
      <ResultsGallery candidates={[manual]} clips={clips} jobId="job" titleRegenerationAvailable />,
    );
    expect(screen.getByRole("heading", { name: "Your selected moments" })).toBeInTheDocument();
    expect(screen.getByText("Exact Cut · Not scored")).toBeInTheDocument();
    expect(screen.queryByText("Why this score")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Regenerate title" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/out of 100/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clip settings" })).toBeInTheDocument();
    expect(screen.getByLabelText("AI minimum strength")).toBeDisabled();
  });
  it("labels transcript selections independently from AI recommendations", () => {
    render(
      <ResultsGallery
        candidates={[{ ...manual, origin: "transcript_selection" }]}
        clips={[]}
        jobId="job"
        titleRegenerationAvailable={false}
      />,
    );
    expect(screen.getByText("Transcript selection · Not scored")).toBeInTheDocument();
  });
  it("keeps deliberately selected ranges visible when filtering AI strength", async () => {
    const user = userEvent.setup();
    render(
      <ResultsGallery
        candidates={[manual, { ...ai, overall_score: 30 }]}
        clips={[]}
        jobId="job"
        titleRegenerationAvailable={false}
      />,
    );
    await user.selectOptions(screen.getByLabelText("AI minimum strength"), "80");
    expect(screen.getByRole("heading", { name: "My exact moment" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Discovered moment" })).not.toBeInTheDocument();
  });
  it("preserves real AI metrics including a legitimate zero", () => {
    render(
      <ResultsGallery
        candidates={[{ ...ai, overall_score: 0 }]}
        clips={[]}
        jobId="job"
        titleRegenerationAvailable={false}
      />,
    );
    expect(screen.getByLabelText("Limited clip strength: 0 out of 100")).toBeInTheDocument();
    expect(screen.getByText("Why this score")).toBeInTheDocument();
    expect(within(screen.getByRole("article")).getByText("Hook")).toBeInTheDocument();
  });
});
