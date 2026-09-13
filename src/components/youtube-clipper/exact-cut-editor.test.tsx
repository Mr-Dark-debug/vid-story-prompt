import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { PLAN_ENTITLEMENTS } from "@/domain/clipping/entitlements";
import { ExactCutEditor, type ExactCutEditorRow } from "./exact-cut-editor";

afterEach(cleanup);
function Harness() {
  const [rows, setRows] = useState<ExactCutEditorRow[]>([]);
  return (
    <ExactCutEditor
      rows={rows}
      onChange={setRows}
      sourceSeconds={600}
      remainingSeconds={60}
      maximumClips={PLAN_ENTITLEMENTS.free.maxClipsPerJob}
    />
  );
}
describe("Exact Cut editor", () => {
  it("pastes five clips, edits a row, reorders and deletes without losing labels", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(
      screen.getByLabelText("Paste timestamp ranges"),
      "0-10,10-20,20-30,30-40,40-50",
    );
    await user.click(screen.getByRole("button", { name: "Add pasted ranges" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(screen.getByRole("status")).toHaveTextContent("50 processing seconds");
    expect(screen.getByRole("button", { name: "Add a range" })).toBeDisabled();
    await user.type(screen.getByLabelText("Label (optional) for clip 1"), "Opening");
    await user.click(screen.getByRole("button", { name: "Move clip 1 down" }));
    expect(screen.getByLabelText("Label (optional) for clip 2")).toHaveValue("Opening");
    await user.clear(screen.getByLabelText("End for clip 2"));
    await user.type(screen.getByLabelText("End for clip 2"), "15");
    expect(screen.getByRole("status")).toHaveTextContent("55 processing seconds");
    expect(screen.getByText(/Some ranges overlap/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove clip 1" }));
    expect(screen.getByLabelText("Label (optional) for clip 1")).toHaveValue("Opening");
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
  });
  it("retains over-limit paste for correction instead of silently truncating it", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(
      screen.getByLabelText("Paste timestamp ranges"),
      "0-20,20-40,40-60,60-80,80-100,100-120",
    );
    await user.click(screen.getByRole("button", { name: "Add pasted ranges" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(6);
    expect(screen.getByText("Your plan allows up to 5 clips per job.")).toBeInTheDocument();
    expect(screen.getByText(/exceed your remaining processing allowance/)).toBeInTheDocument();
  });
  it("shows row-specific inline errors and rejects malformed pasted rows atomically", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByLabelText("Paste timestamp ranges"), "0-10, bad");
    await user.click(screen.getByRole("button", { name: "Add pasted ranges" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Range 2");
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Add a range" }));
    await user.type(screen.getByLabelText("Start for clip 1"), "600");
    await user.type(screen.getByLabelText("End for clip 1"), "601");
    expect(screen.getByLabelText("End for clip 1")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("End exceeds the source duration.")).toBeInTheDocument();
  });
});
