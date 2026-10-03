import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { ChatThreadSummary } from "@/services/ai/threads";
import { ChatMarkdown } from "./chat-markdown";
import type { UiMessage } from "./chat-state";
import { Composer } from "./composer";
import { MessageItem } from "./message-item";
import { ThreadList } from "./thread-list";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    params,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    to: string;
    params?: Record<string, string>;
    children: ReactNode;
  }) => (
    <a href={params ? to.replace("$threadId", params.threadId) : to} {...props}>
      {children}
    </a>
  ),
}));

beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});
afterEach(cleanup);

const NOW = "2026-10-03T12:00:00.000Z";
const assistant = (extra: Partial<UiMessage> = {}): UiMessage => ({
  id: "a1",
  role: "assistant",
  content: "Here are three hooks.",
  status: "complete",
  providerId: "anthropic",
  modelId: "claude-opus-5",
  usageInputTokens: 1_000,
  usageOutputTokens: 500,
  errorCode: null,
  parentMessageId: null,
  createdAt: NOW,
  ...extra,
});

describe("ChatMarkdown", () => {
  it("renders formatting and a code block with a labelled copy action", () => {
    render(
      <ChatMarkdown>
        {"**Bold** and `inline`\n\n```ts\nconst hook = 1;\n```\n\n- one\n- two"}
      </ChatMarkdown>,
    );
    expect(screen.getByText("Bold").tagName).toBe("STRONG");
    expect(screen.getByText("inline").tagName).toBe("CODE");
    expect(screen.getByText("const hook = 1;")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy ts" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("treats model output as untrusted: no raw HTML, no images, no script URLs", () => {
    const { container } = render(
      <ChatMarkdown>
        {[
          '<script>window.__pwned = true</script><img src="https://evil.test/x.png" onerror="alert(1)">',
          "![tracking pixel](https://evil.test/p.png?q=secret)",
          "[click](javascript:alert(1))",
          "[docs](https://example.com/docs)",
        ].join("\n\n")}
      </ChatMarkdown>,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.innerHTML).not.toContain("evil.test");
    expect(container.innerHTML).not.toContain("onerror");
    expect(screen.queryByRole("link", { name: "click" })).toBeNull();
    const link = screen.getByRole("link", { name: "docs" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link.getAttribute("rel")).toContain("noreferrer");
  });
});

describe("MessageItem", () => {
  const handlers = { onRegenerate: vi.fn(), onEdit: vi.fn() };

  it("shows a finished reply with copy, regenerate, tokens and a cost only when pricing exists", async () => {
    const user = userEvent.setup();
    render(
      <MessageItem
        message={assistant()}
        showModelSwitch={false}
        busy={false}
        pricing={{ inputPerMillion: 3, outputPerMillion: 15 }}
        {...handlers}
      />,
    );
    expect(screen.getByText("Here are three hooks.")).toBeInTheDocument();
    expect(screen.getByText(/1,000 in · 500 out tokens · ≈ \$0\.0105/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Regenerate/ }));
    expect(handlers.onRegenerate).toHaveBeenCalledWith(expect.objectContaining({ id: "a1" }));

    cleanup();
    render(
      <MessageItem message={assistant()} showModelSwitch={false} busy={false} {...handlers} />,
    );
    expect(screen.getByText(/1,000 in · 500 out tokens/)).toBeInTheDocument();
    expect(screen.queryByText(/≈ \$/)).toBeNull();
  });

  it("offers no actions while the reply is still streaming", () => {
    render(
      <MessageItem
        message={assistant({ status: "streaming", content: "Partial", usageOutputTokens: null })}
        showModelSwitch={false}
        busy
        {...handlers}
      />,
    );
    expect(screen.getByText("Partial")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Copy|Regenerate|Try again/ })).toBeNull();
  });

  it("explains interrupted, failed and stopped replies truthfully", () => {
    const states: Array<[UiMessage["status"], RegExp]> = [
      ["interrupted", /connection dropped/],
      ["failed", /could not be completed/],
      ["cancelled", /Stopped/],
    ];
    for (const [status, text] of states) {
      const { unmount } = render(
        <MessageItem
          message={assistant({ status })}
          showModelSwitch={false}
          busy={false}
          {...handlers}
        />,
      );
      expect(screen.getByText(text)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
      unmount();
    }
    render(
      <MessageItem
        message={assistant({
          status: "failed",
          errorMessage: "Anthropic rejected this key. Reconnect it in AI providers settings.",
        })}
        showModelSwitch={false}
        busy={false}
        {...handlers}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/Reconnect it/);
  });

  it("marks a change of model in the transcript", () => {
    render(
      <MessageItem
        message={assistant({ providerId: "openai", modelId: "gpt-4o" })}
        showModelSwitch
        busy={false}
        {...handlers}
      />,
    );
    expect(screen.getByText(/Switched to/)).toHaveTextContent("Switched to gpt-4o via OpenAI");
  });

  it("lets the user edit and resend, and blocks that while busy", async () => {
    const user = userEvent.setup();
    const message: UiMessage = {
      ...assistant({ role: "user", id: "u1", content: "Original", status: "complete" }),
    };
    render(<MessageItem message={message} showModelSwitch={false} busy={false} {...handlers} />);
    await user.click(screen.getByRole("button", { name: "Edit message" }));
    const box = screen.getByRole("textbox", { name: "Edit your message" });
    await user.clear(box);
    await user.type(box, "Reworded");
    expect(screen.getByText(/removes this message/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save and resend" }));
    expect(handlers.onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: "u1" }), "Reworded");

    cleanup();
    render(<MessageItem message={message} showModelSwitch={false} busy {...handlers} />);
    expect(screen.getByRole("button", { name: "Edit message" })).toBeDisabled();
  });
});

describe("Composer", () => {
  it("sends on Enter, keeps Shift+Enter for new lines, and clears the box", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<Composer streaming={false} onSend={onSend} onStop={() => {}} />);
    const box = screen.getByRole("textbox", { name: "Message" });
    await user.type(box, "line one{Shift>}{Enter}{/Shift}line two");
    expect(onSend).not.toHaveBeenCalled();
    await user.keyboard("{Enter}");
    expect(onSend).toHaveBeenCalledWith("line one\nline two");
    expect(box).toHaveValue("");
  });

  it("does not send while an IME composition is active, or when empty", () => {
    const onSend = vi.fn();
    render(<Composer streaming={false} onSend={onSend} onStop={() => {}} />);
    const box = screen.getByRole("textbox", { name: "Message" });
    fireEvent.change(box, { target: { value: "こんにちは" } });
    fireEvent.keyDown(box, { key: "Enter", isComposing: true });
    expect(onSend).not.toHaveBeenCalled();
    fireEvent.change(box, { target: { value: "   " } });
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
  });

  it("swaps Send for Stop while a reply streams", async () => {
    const user = userEvent.setup();
    const onStop = vi.fn();
    render(<Composer streaming onSend={() => {}} onStop={onStop} />);
    expect(screen.queryByRole("button", { name: "Send message" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Stop generating" }));
    expect(onStop).toHaveBeenCalledOnce();
  });

  it("refuses over-long drafts and explains why sending is unavailable", () => {
    const { rerender } = render(<Composer streaming={false} onSend={() => {}} onStop={() => {}} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Message" }), {
      target: { value: "x".repeat(32_001) },
    });
    expect(screen.getByRole("alert")).toHaveTextContent("1 characters over the limit");
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();

    rerender(
      <Composer
        streaming={false}
        disabled
        disabledReason="Choose a model to start."
        onSend={() => {}}
        onStop={() => {}}
      />,
    );
    expect(screen.getByText("Choose a model to start.")).toBeInTheDocument();
  });
});

describe("ThreadList", () => {
  const thread = (
    id: string,
    title: string,
    lastMessageAt: string,
    archivedAt: string | null = null,
  ): ChatThreadSummary => ({
    id,
    title,
    archivedAt,
    lastMessageAt,
    providerId: null,
    modelId: null,
    credentialId: null,
    clipJobId: null,
  });
  const today = new Date().toISOString();
  const old = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const props = () => ({
    active: [thread("t1", "Hook ideas", today), thread("t2", "Caption rewrite", old)],
    archived: [thread("t3", "Old pitch", old, old)],
    activeId: "t1",
    onRename: vi.fn(),
    onArchive: vi.fn(),
    onDelete: vi.fn(),
  });

  it("groups by date, marks the current chat and links each thread", () => {
    render(<ThreadList {...props()} />);
    expect(screen.getByRole("heading", { name: "Today" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Older" })).toBeInTheDocument();
    const current = screen.getByRole("link", { name: "Hook ideas" });
    expect(current).toHaveAttribute("aria-current", "page");
    expect(current).toHaveAttribute("href", "/app/chat/t1");
    expect(screen.getByRole("link", { name: "New chat" })).toHaveAttribute("href", "/app/chat");
  });

  it("searches, and switches to archived chats", async () => {
    const user = userEvent.setup();
    render(<ThreadList {...props()} />);
    await user.type(screen.getByRole("searchbox", { name: "Search chats" }), "caption");
    expect(screen.queryByRole("link", { name: "Hook ideas" })).toBeNull();
    expect(screen.getByRole("link", { name: "Caption rewrite" })).toBeInTheDocument();
    await user.type(screen.getByRole("searchbox", { name: "Search chats" }), "zzz");
    expect(screen.getByText("No chats match your search.")).toBeInTheDocument();
    await user.clear(screen.getByRole("searchbox", { name: "Search chats" }));
    await user.click(screen.getByRole("button", { name: /Archived \(1\)/ }));
    expect(screen.getByRole("link", { name: "Old pitch" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Hook ideas" })).toBeNull();
  });

  it("renames inline, archives and deletes through callbacks", async () => {
    const user = userEvent.setup();
    const p = props();
    render(<ThreadList {...p} />);
    await user.click(screen.getByRole("button", { name: "Actions for Hook ideas" }));
    await user.click(await screen.findByRole("menuitem", { name: "Rename" }));
    const input = screen.getByRole("textbox", { name: "Chat title" });
    await user.clear(input);
    await user.type(input, "Better title{Enter}");
    expect(p.onRename).toHaveBeenCalledWith(expect.objectContaining({ id: "t1" }), "Better title");

    // The list is controlled by its parent, so the row keeps its old title until props change.
    await user.click(screen.getByRole("button", { name: "Actions for Hook ideas" }));
    await user.click(await screen.findByRole("menuitem", { name: "Archive" }));
    expect(p.onArchive).toHaveBeenCalledWith(expect.objectContaining({ id: "t1" }), true);

    await user.click(screen.getByRole("button", { name: "Actions for Hook ideas" }));
    await user.click(await screen.findByRole("menuitem", { name: /Delete permanently/ }));
    expect(p.onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: "t1" }));
  });
});
