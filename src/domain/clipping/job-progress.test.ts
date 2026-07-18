import { describe, expect, it } from "vitest";
import { deriveJobStages, getJobStatusPresentation } from "./job-progress";

const task = (taskType: string, status: string) => ({ task_type: taskType, status });

describe("clipping job progress", () => {
  it("preserves completed work and marks the actual failed stage", () => {
    const stages = deriveJobStages(
      { status: "failed" },
      [task("download_youtube_source", "succeeded"), task("validate_source", "failed")],
    );
    expect(stages.find((stage) => stage.id === "awaiting_source")?.state).toBe("completed");
    expect(stages.find((stage) => stage.id === "validating")?.state).toBe("failed");
    expect(stages.find((stage) => stage.id === "creating_proxy")?.state).toBe("pending");
  });

  it("shows retry wait on the task's real stage", () => {
    const stages = deriveJobStages(
      { status: "failed" },
      [task("download_youtube_source", "retry_wait")],
    );
    expect(stages.find((stage) => stage.id === "awaiting_source")?.state).toBe("retrying");
  });

  it("uses semantic human status labels", () => {
    expect(getJobStatusPresentation("retry_wait")).toMatchObject({
      label: "Retrying",
      tone: "warning",
    });
    expect(getJobStatusPresentation("ready")).toMatchObject({
      label: "Ready",
      tone: "success",
    });
    expect(getJobStatusPresentation("failed")).toMatchObject({
      label: "Failed",
      tone: "danger",
    });
  });
});
