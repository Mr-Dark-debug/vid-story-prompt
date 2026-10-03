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
vi.mock("@/services/ai/runs", () => ({ enqueueSocialCopyRuns: vi.fn(), cancelAiRun: vi.fn() }));
import { cancelAiRun, enqueueSocialCopyRuns } from "@/services/ai/runs";
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

describe("background AI features", () => {
  const base = { candidates: [manual], clips, jobId: "job" };

  it("states which model produced the plan, and says nothing for older jobs", () => {
    const { rerender } = render(
      <ResultsGallery
        {...base}
        titleRegenerationAvailable
        planning={{
          provider: "anthropic",
          model: "claude-opus-5",
          credential_source: "user_key",
          fallback_reason: null,
          input_token_count: 1200,
          output_token_count: 340,
        }}
      />,
    );
    expect(screen.getByTestId("planning-provenance")).toHaveTextContent(
      "Planned with your Anthropic key (claude-opus-5). 1,200 in · 340 out tokens.",
    );
    rerender(
      <ResultsGallery
        {...base}
        titleRegenerationAvailable
        planning={{
          provider: "deterministic",
          model: "deterministic-v1",
          credential_source: "deterministic",
          fallback_reason: "credential_invalid",
          input_token_count: null,
          output_token_count: null,
        }}
      />,
    );
    expect(screen.getByTestId("planning-provenance")).toHaveTextContent(
      /Reconnect it in AI providers settings/,
    );
    rerender(<ResultsGallery {...base} titleRegenerationAvailable planning={null} />);
    expect(screen.queryByTestId("planning-provenance")).not.toBeInTheDocument();
  });

  it("queues background copy for the selected clips only, once per click", async () => {
    const user = userEvent.setup();
    vi.mocked(enqueueSocialCopyRuns).mockResolvedValue({ runs: [] });
    render(<ResultsGallery {...base} titleRegenerationAvailable />);
    const button = screen.getByRole("button", { name: /Write copy with AI/ });
    expect(button).toBeDisabled();
    await user.click(screen.getByLabelText("Select My exact moment"));
    expect(button).toHaveTextContent("Write copy with AI (1)");
    await user.click(button);
    expect(enqueueSocialCopyRuns).toHaveBeenCalledOnce();
    const call = vi.mocked(enqueueSocialCopyRuns).mock.calls[0][0] as unknown as {
      data: { clipIds: string[]; batchId: string };
    };
    expect(call.data.clipIds).toEqual(["clip"]);
    expect(call.data.batchId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("cannot queue copy without a usable model", () => {
    render(<ResultsGallery {...base} titleRegenerationAvailable={false} />);
    expect(screen.getByRole("button", { name: /Write copy with AI/ })).toBeDisabled();
  });

  it("shows live run state per clip, with cancel for active runs and a safe message for failures", async () => {
    const user = userEvent.setup();
    vi.mocked(cancelAiRun).mockResolvedValue({ cancelled: true });
    const run = (status: string, errorMessage: string | null = null) => ({
      id: "run-1",
      status,
      clipId: "clip",
      errorCode: null,
      errorMessage,
      createdAt: "2026-10-03T12:00:00Z",
    });
    const { rerender } = render(
      <ResultsGallery {...base} titleRegenerationAvailable aiRuns={[run("running")]} />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Writing copy with your model…");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(cancelAiRun).toHaveBeenCalledWith({ data: { runId: "run-1" } });

    rerender(
      <ResultsGallery
        {...base}
        titleRegenerationAvailable
        aiRuns={[
          run("failed", "Anthropic rejected this key. Reconnect it in AI providers settings."),
        ]}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/Reconnect it/);
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });
});
