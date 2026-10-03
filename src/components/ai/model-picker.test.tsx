import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { NormalizedModel } from "@/domain/ai/types";
import type { AiModelGroup } from "@/services/ai/server";
import { ModelPicker } from "./model-picker";

beforeAll(() => {
  // cmdk and Radix expect these browser APIs, which jsdom lacks.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
});

const model = (
  providerId: string,
  modelId: string,
  extra: Partial<NormalizedModel> = {},
): NormalizedModel => ({
  providerId,
  modelId,
  displayName: modelId,
  family: "generic",
  contextWindow: null,
  maxOutput: null,
  supportsVision: false,
  supportsJsonSchema: false,
  supportsStreaming: true,
  ...extra,
});

const groups: AiModelGroup[] = [
  {
    credentialId: "c-claude",
    providerId: "anthropic",
    label: "Personal",
    status: "active",
    fetchedAt: "2026-10-03T00:00:00Z",
    models: [
      model("anthropic", "claude-opus-5", {
        displayName: "Claude Opus 5",
        family: "anthropic",
        contextWindow: 1_000_000,
        supportsVision: true,
        supportsJsonSchema: true,
      }),
    ],
  },
  {
    credentialId: "c-or",
    providerId: "openrouter",
    label: "Router",
    status: "active",
    fetchedAt: "2026-10-03T00:00:00Z",
    models: [
      model("openrouter", "meta-llama/llama-3.3-70b", {
        displayName: "Meta: Llama 3.3 70B",
        family: "meta",
        contextWindow: 131_072,
        pricing: { inputPerMillion: 0.1, outputPerMillion: 0.3 },
      }),
    ],
  },
  {
    credentialId: "c-dead",
    providerId: "openai",
    label: "Old key",
    status: "invalid",
    fetchedAt: "x",
    models: [model("openai", "gpt-hidden", { displayName: "GPT Hidden" })],
  },
];

function setWidth(width: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width, writable: true });
}

beforeEach(() => {
  window.localStorage.clear();
  setWidth(1280);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ModelPicker", () => {
  it("lists active connections' models with maker logos, context, capabilities and price hints", async () => {
    const user = userEvent.setup();
    render(<ModelPicker groups={groups} value={null} onChange={() => {}} />);
    await user.click(screen.getByRole("combobox", { name: "Model" }));

    expect(screen.getByText("Anthropic · Personal")).toBeInTheDocument();
    expect(screen.getByText("OpenRouter · Router")).toBeInTheDocument();
    const claude = screen.getByText("Claude Opus 5").closest("[cmdk-item]") as HTMLElement;
    expect(within(claude).getByText("1M context")).toBeInTheDocument();
    expect(within(claude).getByText("Vision")).toBeInTheDocument();
    expect(within(claude).getByText("JSON")).toBeInTheDocument();
    // First-party model: maker mark only. Hosted model: maker mark plus the OpenRouter badge.
    expect(within(claude).getAllByRole("img")).toHaveLength(1);
    const llama = screen.getByText("Meta: Llama 3.3 70B").closest("[cmdk-item]") as HTMLElement;
    expect(within(llama).getByText("$0.1 in · $0.3 out / 1M tokens")).toBeInTheDocument();
    expect(within(llama).getByRole("img", { name: "Meta" })).toBeInTheDocument();
    expect(within(llama).getByRole("img", { name: "OpenRouter" })).toBeInTheDocument();
    // A rejected key cannot run anything, so its models are not offered.
    expect(screen.queryByText("GPT Hidden")).not.toBeInTheDocument();
  });

  it("filters as you type and reports the selected model", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ModelPicker groups={groups} value={null} onChange={onChange} />);
    await user.click(screen.getByRole("combobox", { name: "Model" }));
    await user.type(screen.getByRole("combobox", { name: "Search models" }), "llama");

    expect(screen.queryByText("Claude Opus 5")).not.toBeInTheDocument();
    await user.click(screen.getByText("Meta: Llama 3.3 70B"));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ key: "c-or::meta-llama/llama-3.3-70b", credentialId: "c-or" }),
    );
    // Selection closes the popover and shows the choice on the trigger.
    expect(screen.queryByRole("combobox", { name: "Search models" })).not.toBeInTheDocument();
  });

  it("pins favorites and remembers recents in local storage", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<ModelPicker groups={groups} value={null} onChange={onChange} />);
    await user.click(screen.getByRole("combobox", { name: "Model" }));
    await user.click(screen.getByRole("button", { name: "Add Claude Opus 5 to favorites" }));

    expect(screen.getByText("Favorites")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("vidrial.ai.favorite-models")!)).toEqual([
      "c-claude::claude-opus-5",
    ]);
    // Toggling a favorite must not select the row.
    expect(onChange).not.toHaveBeenCalled();

    await user.click(screen.getByText("Meta: Llama 3.3 70B"));
    expect(JSON.parse(window.localStorage.getItem("vidrial.ai.recent-models")!)).toEqual([
      "c-or::meta-llama/llama-3.3-70b",
    ]);

    rerender(
      <ModelPicker groups={groups} value={"c-or::meta-llama/llama-3.3-70b"} onChange={onChange} />,
    );
    expect(screen.getByRole("combobox", { name: "Model" })).toHaveTextContent(
      "Meta: Llama 3.3 70B",
    );
  });

  it("survives blocked storage", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const user = userEvent.setup();
    render(<ModelPicker groups={groups} value={null} onChange={() => {}} />);
    await user.click(screen.getByRole("combobox", { name: "Model" }));
    await user.click(screen.getByRole("button", { name: "Add Claude Opus 5 to favorites" }));
    expect(screen.getByText("Favorites")).toBeInTheDocument();
  });

  it("explains an empty catalogue and offers a no-model option when allowed", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ModelPicker
        groups={[]}
        value={null}
        onChange={onChange}
        none={{ label: "Built-in selection" }}
      />,
    );
    expect(screen.getByRole("combobox", { name: "Model" })).toHaveTextContent("Built-in selection");
    await user.click(screen.getByRole("combobox", { name: "Model" }));
    expect(screen.getByText(/Connect a provider key/)).toBeInTheDocument();
    await user.click(screen.getByText("Built-in selection", { selector: "span.text-sm" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("opens as a bottom sheet at 360px", async () => {
    setWidth(360);
    const user = userEvent.setup();
    render(<ModelPicker groups={groups} value={null} onChange={() => {}} />);
    await user.click(screen.getByRole("combobox", { name: "Model" }));
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByText("Choose a model")).toBeInTheDocument();
    expect(within(sheet).getByText("Claude Opus 5")).toBeInTheDocument();
    fireEvent.keyDown(sheet, { key: "Escape" });
  });
});
