import { describe, expect, it } from "vitest";
import { deriveJobStages, getJobStatusPresentation } from "./job-progress";

const task = (taskType: string, status: string) => ({ task_type: taskType, status });

describe("clipping job progress", () => {
  it("preserves completed work and marks the actual failed stage", () => {
    const stages = deriveJobStages({ status: "failed" }, [
      task("download_youtube_source", "succeeded"),
      task("validate_source", "failed"),
    ]);
    expect(stages.find((stage) => stage.id === "awaiting_source")?.state).toBe("completed");
    expect(stages.find((stage) => stage.id === "validating")?.state).toBe("failed");
    expect(stages.find((stage) => stage.id === "creating_proxy")?.state).toBe("pending");
  });

  it("shows retry wait on the task's real stage", () => {
    const stages = deriveJobStages({ status: "failed" }, [
      task("download_youtube_source", "retry_wait"),
    ]);
    expect(stages.find((stage) => stage.id === "awaiting_source")?.state).toBe("retrying");
  });

  it("does not mark the queue green when source import is the first failed task", () => {
    const stages = deriveJobStages({ status: "failed" }, [
      task("download_youtube_source", "dead_lettered"),
    ]);
    expect(stages.find((stage) => stage.id === "awaiting_source")?.state).toBe("failed");
    expect(stages.find((stage) => stage.id === "queued")?.state).toBe("pending");
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
    expect(getJobStatusPresentation("awaiting_authorised_source")).toMatchObject({
      label: "Source needed",
      tone: "info",
    });
    expect(getJobStatusPresentation("awaiting_local_relay")).toMatchObject({
      label: "Waiting for helper",
      tone: "warning",
    });
  });

  it("shows recoverable acquisition as waiting and ignores superseded failures", () => {
    const waiting = deriveJobStages({ status: "awaiting_authorised_source" }, [
      task("download_youtube_source", "dead_lettered"),
    ]);
    expect(waiting.find((stage) => stage.id === "awaiting_source")?.state).toBe("retrying");

    const resumed = deriveJobStages({ status: "queued" }, [
      task("download_youtube_source", "superseded"),
      task("validate_source", "queued"),
    ]);
    expect(resumed.find((stage) => stage.id === "awaiting_source")?.state).toBe("pending");
    expect(resumed.find((stage) => stage.id === "validating")?.state).toBe("pending");
  });

  it("keeps source acquisition active while a local relay device is needed", () => {
    const stages = deriveJobStages({ status: "awaiting_local_relay" }, [
      task("download_youtube_source", "dead_lettered"),
    ]);

    expect(stages.find((stage) => stage.id === "awaiting_source")?.state).toBe("retrying");
  });
});
