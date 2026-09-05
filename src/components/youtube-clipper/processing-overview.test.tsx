import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ProcessingOverview } from "./processing-overview";
afterEach(cleanup);
describe("processing overview", () => {
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
