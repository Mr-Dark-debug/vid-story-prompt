import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));

import { SourcePicker } from "./source-picker";

beforeEach(() => window.localStorage.clear());
afterEach(() => cleanup());

describe("source picker", () => {
  it("searches grouped sources and records the selected connector as recent", () => {
    const onChange = vi.fn();
    render(<SourcePicker value="youtube" onChange={onChange} connectedIds={["google_drive"]} />);

    fireEvent.click(screen.getByRole("button", { name: "Choose source" }));
    fireEvent.change(screen.getByLabelText("Search sources"), {
      target: { value: "podcast audio" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Podcast RSS/ }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ id: "rss" }));
    expect(JSON.parse(window.localStorage.getItem("vidrial.recent-connectors.v1") ?? "[]")).toEqual(
      ["rss"],
    );
  });

  it("keeps the four compact quick actions directly selectable", () => {
    const onChange = vi.fn();
    render(<SourcePicker value="youtube" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Paste media link" }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ id: "direct_url" }));
  });
});
