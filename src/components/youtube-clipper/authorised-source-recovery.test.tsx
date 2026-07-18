import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/connectors/source-picker", () => ({
  SourcePicker: () => <button type="button">Choose video source</button>,
}));
vi.mock("./source-upload", () => ({
  SourceUpload: () => <div>Upload control</div>,
}));
vi.mock("./job-wizard", () => ({
  CloudAssetBrowser: () => <div>Cloud browser</div>,
}));
vi.mock("@/services/clipping/server", () => ({
  attachSourceAndResumeClipJob: vi.fn(),
  attachDirectSourceAndResumeClipJob: vi.fn(),
}));
vi.mock("@/services/connectors/assets.server", () => ({
  cancelConnectorImport: vi.fn(),
  createConnectorImport: vi.fn(),
  getConnectorImportProgress: vi.fn(),
}));

import { AuthorisedSourceRecovery } from "./authorised-source-recovery";

describe("authorised source recovery", () => {
  it("explains same-job recovery and requires a rights confirmation", () => {
    render(
      <AuthorisedSourceRecovery
        jobId="00000000-0000-4000-8000-000000000001"
        sourceAssetId={null}
        errorCode="provider_auth_challenge"
        connectedConnectorIds={[]}
        onResumed={vi.fn()}
      />,
    );
    expect(screen.getByText("Add the original source to continue")).toBeInTheDocument();
    expect(screen.getByText(/existing usage reservation stay on this job/i)).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(screen.getByText("Upload control")).toBeInTheDocument();
  });
});
