import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/services/ai/server", () => ({ listAiModels: vi.fn() }));
vi.mock("@/services/projects/server", () => ({ planProjectEdit: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { listAiModels } from "@/services/ai/server";
import { planProjectEdit } from "@/services/projects/server";
import { AIPanel } from "./ai-panel";

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const credentialId = "6f1c0a54-0000-4000-8000-000000000001";
const groups = [
  {
    credentialId,
    providerId: "anthropic",
    label: "Personal",
    status: "active" as const,
    fetchedAt: "2026-10-03T00:00:00Z",
    models: [
      {
        providerId: "anthropic",
        modelId: "claude-opus-5",
        displayName: "Claude Opus 5",
        family: "anthropic",
        contextWindow: 1_000_000,
        maxOutput: 128_000,
        supportsVision: true,
        supportsJsonSchema: true,
        supportsStreaming: true,
      },
    ],
  },
];
const plan = (source: "user_key" | "platform") => ({
  id: "plan_1",
  prompt: "p",
  createdAt: "2026-10-03T00:00:00Z",
  summary: "A short cut",
  estimatedMinutes: 1,
  model: { source, providerId: source === "user_key" ? "anthropic" : "openrouter", modelId: "m-1" },
  operations: [],
});

describe("AI editor panel model choice", () => {
  it("behaves as before when the user has no provider keys", async () => {
    vi.mocked(listAiModels).mockResolvedValue([]);
    vi.mocked(planProjectEdit).mockResolvedValue(plan("platform") as never);
    const user = userEvent.setup();
    render(<AIPanel projectId="project-1" />);
    await waitFor(() => expect(listAiModels).toHaveBeenCalled());
    expect(screen.queryByRole("combobox", { name: "AI model for this edit" })).toBeNull();

    await user.click(screen.getByRole("button", { name: /Build a concise 90-second first cut/ }));
    const call = vi.mocked(planProjectEdit).mock.calls[0][0] as unknown as {
      data: Record<string, unknown>;
    };
    expect(call.data).toEqual({ projectId: "project-1", prompt: expect.any(String) });
    expect(await screen.findByText("Planned with Vidrial's built-in model")).toBeInTheDocument();
  });

  it("lets the user pick a model, discloses data sharing, and sends the choice", async () => {
    vi.mocked(listAiModels).mockResolvedValue(groups);
    vi.mocked(planProjectEdit).mockResolvedValue(plan("user_key") as never);
    const user = userEvent.setup();
    render(<AIPanel projectId="project-1" />);

    const picker = await screen.findByRole("combobox", { name: "AI model for this edit" });
    expect(picker).toHaveTextContent("Default model");
    await user.click(picker);
    await user.click(await screen.findByText("Claude Opus 5"));
    expect(screen.getByText(/sent to this provider using your key/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Create a 30-second vertical cut/ }));
    const call = vi.mocked(planProjectEdit).mock.calls[0][0] as unknown as {
      data: Record<string, unknown>;
    };
    expect(call.data).toMatchObject({ model: { credentialId, modelId: "claude-opus-5" } });
    expect(await screen.findByText("Planned with your key (m-1)")).toBeInTheDocument();
  });

  it("still works if the model list cannot be loaded", async () => {
    vi.mocked(listAiModels).mockRejectedValue(new Error("offline"));
    render(<AIPanel projectId="project-1" />);
    await waitFor(() => expect(listAiModels).toHaveBeenCalled());
    expect(
      screen.getByRole("button", { name: /Build a concise 90-second first cut/ }),
    ).toBeEnabled();
  });
});
