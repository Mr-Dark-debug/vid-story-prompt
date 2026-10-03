import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/services/ai/threads", () => ({
  setChatRetention: vi.fn().mockResolvedValue({ days: 30 }),
  deleteAllChatThreads: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { deleteAllChatThreads, setChatRetention } from "@/services/ai/threads";
import { ChatHistoryPanel, retentionValue } from "./chat-history-panel";

beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("chat history controls", () => {
  it("maps stored values to options and keeps unusual ones visible", () => {
    expect(retentionValue(null)).toBe("keep");
    expect(retentionValue(30)).toBe("30");
    expect(retentionValue(45)).toBe("custom:45");
  });

  it("states that deletion is permanent and saves a new retention period", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    render(<ChatHistoryPanel retentionDays={null} onChanged={onChanged} />);
    expect(screen.getByText(/Deleting a chat erases it permanently/)).toBeInTheDocument();
    await user.click(screen.getByRole("combobox", { name: "Automatically delete chats" }));
    await user.click(await screen.findByRole("menuitemradio", { name: /30 days/ }));
    await waitFor(() => expect(setChatRetention).toHaveBeenCalledWith({ data: { days: 30 } }));
    expect(onChanged).toHaveBeenCalled();
  });

  it("asks for confirmation before erasing every chat", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    render(<ChatHistoryPanel retentionDays={90} onChanged={onChanged} />);
    await user.click(screen.getByRole("button", { name: "Delete all chats" }));
    expect(deleteAllChatThreads).not.toHaveBeenCalled();
    expect(await screen.findByText("Delete all your chats permanently?")).toBeInTheDocument();
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete all chats" }));
    await waitFor(() => expect(deleteAllChatThreads).toHaveBeenCalledOnce());
    expect(onChanged).toHaveBeenCalled();
  });
});
