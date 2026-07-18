import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { PublicConnectorDefinition } from "@/domain/connectors/types";
import { ConnectorSettingsDialog } from "./connector-settings-dialog";

const connector = {
  id: "youtube",
  label: "YouTube",
  description: "Import and manage YouTube media.",
  availability: "available",
  icon: "youtube",
} as PublicConnectorDefinition;

describe("ConnectorSettingsDialog", () => {
  it("guards dirty settings with continue, discard, and save choices", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onSave = vi.fn();
    render(
      <ConnectorSettingsDialog
        connector={connector}
        open
        onOpenChange={onOpenChange}
        isDirty
        onSave={onSave}
      >
        <p>Settings body</p>
      </ConnectorSettingsDialog>,
    );

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Save connector changes?");
    expect(screen.getByRole("button", { name: "Continue editing" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Discard" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
