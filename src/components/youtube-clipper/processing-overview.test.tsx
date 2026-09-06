import { render, screen, cleanup, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ProcessingOverview } from "./processing-overview";
afterEach(cleanup);
describe("processing overview", () => {
  it("does not label a partially successful render batch as complete", () => {
    render(
      <ProcessingOverview
        job={{ status: "partially_ready", completed_clip_count: 2, requested_clip_count: 5 }}
        tasks={[
          { task_type: "render_clip_preview", status: "succeeded" },
          { task_type: "render_clip_preview", status: "dead_lettered" },
        ]}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Some clips are ready to review");
    const steps = screen.getAllByRole("listitem");
    expect(within(steps[2]).getByText("Needs attention")).toBeInTheDocument();
    expect(within(steps[3]).getByText("Partially ready")).toBeInTheDocument();
  });
  it("does not animate processing while waiting for an authorised source", () => {
    const { container } = render(
      <ProcessingOverview
        job={{
          status: "awaiting_authorised_source",
          completed_clip_count: 0,
          requested_clip_count: 5,
        }}
        tasks={[{ task_type: "download_source", status: "dead_lettered" }]}
      />,
    );
    expect(screen.getByText("Source needed")).toBeInTheDocument();
    expect(container.querySelector('[aria-current="step"]')).toBeNull();
    expect(container.querySelector(".animate-spin")).toBeNull();
  });
  it("announces actual rendered previews during rendering", () => {
    render(
      <ProcessingOverview
        job={{ status: "rendering_previews", completed_clip_count: 2, requested_clip_count: 5 }}
        tasks={[{ task_type: "render_clip_preview", status: "running" }]}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("2 of 5 clip previews rendered");
  });
  it("announces actual completed audio sections without invented percentages", () => {
    render(
      <ProcessingOverview
        job={{ status: "transcribing", completed_clip_count: 0, requested_clip_count: 5 }}
        tasks={[
          { task_type: "transcribe_chunk", status: "succeeded" },
          { task_type: "transcribe_chunk", status: "running" },
        ]}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("1 of 2 audio sections transcribed");
    expect(screen.getByRole("list", { name: "Clipping progress" })).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
  it("shows saved results when a completed job has an old failed auxiliary task", () => {
    render(
      <ProcessingOverview
        job={{ status: "ready", completed_clip_count: 3, requested_clip_count: 3 }}
        tasks={[
          { task_type: "create_proxy", status: "dead_lettered" },
          { task_type: "render_clip_preview", status: "succeeded" },
        ]}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("3 of 3 clip previews available");
    expect(screen.queryByText("Needs attention")).not.toBeInTheDocument();
  });
});
