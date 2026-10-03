import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { AiConnection } from "@/services/ai/server";
import { AddKeyDialog, type KeyDialogProvider } from "./add-key-dialog";
import { describeConnection, formatVerified } from "./connection-status";
import { ProviderCard, type ProviderCardProvider } from "./provider-card";

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
afterEach(cleanup);

const connection = (extra: Partial<AiConnection> = {}): AiConnection => ({
  id: "c1",
  providerId: "anthropic",
  label: "Personal",
  last4: "wxyz",
  status: "active",
  lastVerifiedAt: "2026-10-03T11:55:00Z",
  lastErrorCode: null,
  modelCount: 12,
  modelsFetchedAt: "2026-10-03T11:55:00Z",
  ...extra,
});

const anthropic: ProviderCardProvider = {
  id: "anthropic",
  label: "Anthropic",
  description: "Claude models through your Anthropic API key.",
  availability: "available",
  connectable: true,
};

describe("connection status", () => {
  it("never reports a failing connection as active", () => {
    expect(describeConnection(connection())).toMatchObject({ label: "Active", variant: "success" });
    expect(describeConnection(connection({ status: "invalid" }))).toMatchObject({
      label: "Needs reconnect",
      variant: "danger",
    });
    expect(describeConnection(connection({ lastErrorCode: "rate_limited" }))).toMatchObject({
      label: "Rate limited",
      variant: "warning",
    });
    expect(describeConnection(connection({ lastErrorCode: "network" }))).toMatchObject({
      label: "Could not verify",
    });
    expect(describeConnection(connection({ status: "revoked" })).label).toBe("Revoked");
  });

  it("describes verification age without inventing certainty", () => {
    const now = Date.parse("2026-10-03T12:00:00Z");
    expect(formatVerified(null, now)).toBe("Not verified yet");
    expect(formatVerified("2026-10-03T11:59:30Z", now)).toBe("Verified just now");
    expect(formatVerified("2026-10-03T11:30:00Z", now)).toBe("Verified 30 min ago");
    expect(formatVerified("2026-10-03T06:00:00Z", now)).toBe("Verified 6 h ago");
    expect(formatVerified("2026-09-28T12:00:00Z", now)).toBe("Verified 5 days ago");
  });
});

describe("ProviderCard", () => {
  const renderCard = (
    connections: AiConnection[],
    props: Partial<Parameters<typeof ProviderCard>[0]> = {},
  ) => {
    const onAdd = vi.fn();
    const onAction = vi.fn();
    render(
      <ProviderCard
        provider={anthropic}
        connections={connections}
        busyId={null}
        canAdd
        onAdd={onAdd}
        onAction={onAction}
        {...props}
      />,
    );
    return { onAdd, onAction };
  };

  it("shows an honest not-connected state with a connect action", async () => {
    const { onAdd } = renderCard([]);
    expect(screen.getByText("Not connected")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Connect Anthropic key" }));
    expect(onAdd).toHaveBeenCalledOnce();
  });

  it("shows last four only, the model count and verification state", () => {
    renderCard([connection()]);
    expect(screen.getByText("••••wxyz")).toBeInTheDocument();
    expect(screen.getByText(/12 models/)).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.queryByText(/sk-/)).not.toBeInTheDocument();
  });

  it("offers reconnect for a rejected key and hides model actions for a revoked one", async () => {
    const user = userEvent.setup();
    const { onAction } = renderCard([connection({ status: "invalid", id: "bad" })]);
    expect(screen.getByText("Needs reconnect")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Actions for Personal" }));
    await user.click(await screen.findByRole("menuitem", { name: "Reconnect with a new key" }));
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ id: "bad" }), "replace");

    cleanup();
    renderCard([connection({ status: "revoked", modelCount: null })]);
    await user.click(screen.getByRole("button", { name: "Actions for Personal" }));
    expect(await screen.findByRole("menuitem", { name: "Delete connection" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Refresh models" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /Revoke/ })).not.toBeInTheDocument();
  });

  it("dispatches every management action for an active key", async () => {
    const user = userEvent.setup();
    const { onAction } = renderCard([connection()]);
    const open = () => user.click(screen.getByRole("button", { name: "Actions for Personal" }));
    for (const [name, action] of [
      ["Refresh models", "refresh"],
      ["Re-check key", "revalidate"],
      ["Replace key", "replace"],
      ["Revoke (erase stored key)", "revoke"],
      ["Delete connection", "delete"],
    ] as const) {
      await open();
      await user.click(await screen.findByRole("menuitem", { name }));
      expect(onAction).toHaveBeenLastCalledWith(expect.objectContaining({ id: "c1" }), action);
    }
  });

  it("disables adding keys when the deployment cannot encrypt them", () => {
    renderCard([], { canAdd: false });
    expect(screen.getByRole("button", { name: "Connect Anthropic key" })).toBeDisabled();
  });

  it("marks coming-soon providers as not connectable", () => {
    renderCard([], { provider: { ...anthropic, availability: "coming_soon", connectable: false } });
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Connect/ })).not.toBeInTheDocument();
  });
});

describe("AddKeyDialog", () => {
  const provider: KeyDialogProvider = {
    id: "anthropic",
    label: "Anthropic",
    keyHelpUrl: "https://console.anthropic.com/settings/keys",
    keyPrefixHint: "sk-ant-",
    availability: "available",
  };

  it("requires the disclosure before a key can be saved and masks the key field", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <AddKeyDialog provider={provider} mode="add" onOpenChange={() => {}} onSubmit={onSubmit} />,
    );

    const key = screen.getByLabelText("API key");
    expect(key).toHaveAttribute("type", "password");
    expect(key).toHaveAttribute("autocomplete", "off");
    const save = screen.getByRole("button", { name: "Validate and save" });
    await user.type(key, "sk-ant-api03-ABCDEFGH");
    expect(save).toBeDisabled();
    expect(screen.getByText(/will be\s+sent to Anthropic using your key/)).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox"));
    expect(save).toBeEnabled();
    await user.click(save);
    expect(onSubmit).toHaveBeenCalledWith({ label: "Personal", apiKey: "sk-ant-api03-ABCDEFGH" });
  });

  it("links to the provider's key page safely", () => {
    render(
      <AddKeyDialog provider={provider} mode="add" onOpenChange={() => {}} onSubmit={vi.fn()} />,
    );
    const link = screen.getByRole("link", { name: /Where do I find it/ });
    expect(link).toHaveAttribute("href", provider.keyHelpUrl);
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("shows a safe error, keeps the dialog open and never retains the typed key", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onSubmit = vi
      .fn()
      .mockRejectedValue(
        new Error("Anthropic rejected this key. Check that you copied it completely."),
      );
    render(
      <AddKeyDialog
        provider={provider}
        mode="add"
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
      />,
    );
    await user.type(screen.getByLabelText("API key"), "sk-ant-api03-WRONGWRONG");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Validate and save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Anthropic rejected this key");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    await waitFor(() => expect(screen.getByLabelText("API key")).toHaveValue(""));
  });

  it("replace mode skips the label and the first-use disclosure", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    render(
      <AddKeyDialog
        provider={provider}
        mode="replace"
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
      />,
    );
    expect(screen.queryByLabelText("Label")).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("API key"), "sk-ant-api03-NEWNEWNEW");
    await user.click(screen.getByRole("button", { name: "Validate and replace" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("flags beta providers as not yet exercised with live keys", () => {
    render(
      <AddKeyDialog
        provider={{ ...provider, id: "groq", label: "Groq", availability: "beta" }}
        mode="add"
        onOpenChange={() => {}}
        onSubmit={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Groq is in beta/)).toBeInTheDocument();
  });
});
