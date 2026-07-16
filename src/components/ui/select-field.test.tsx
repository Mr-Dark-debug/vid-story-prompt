import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { SelectField } from "./select-field";

afterEach(cleanup);
beforeAll(() => {
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterAll(() => vi.restoreAllMocks());

describe("SelectField", () => {
  it("renders an accessible controlled value picker", () => {
    render(
      <SelectField
        label="Requested clips"
        value="5"
        onValueChange={vi.fn()}
        hint="Free includes up to 5 clips per job."
        options={[
          { value: "5", label: "5 clips" },
          { value: "10", label: "10 clips", badge: "Creator", disabled: true },
        ]}
      />,
    );

    expect(screen.getByRole("combobox", { name: "Requested clips" })).toHaveTextContent("5 clips");
    expect(screen.getByText("Free includes up to 5 clips per job.")).toBeInTheDocument();
  });

  it("shows locked options as disabled choices", () => {
    render(
      <SelectField
        label="Requested clips"
        value="5"
        onValueChange={vi.fn()}
        options={[
          { value: "5", label: "5 clips" },
          { value: "10", label: "10 clips", badge: "Creator", disabled: true },
        ]}
      />,
    );

    const trigger = screen.getByRole("combobox");
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const locked = screen.getByRole("menuitemradio", { name: /10 clips\s*Creator/ });
    expect(locked).toHaveAttribute("data-disabled");
  });

  it("keeps controlled form submission behavior", () => {
    const onValueChange = vi.fn();
    const { container } = render(
      <SelectField
        label="Requested clips"
        name="clipCount"
        value="5"
        onValueChange={onValueChange}
        options={[
          { value: "5", label: "5 clips" },
          { value: "10", label: "10 clips" },
        ]}
      />,
    );

    expect(container.querySelector('input[name="clipCount"]')).toHaveValue("5");
    const trigger = screen.getByRole("combobox");
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.click(screen.getByRole("menuitemradio", { name: "10 clips" }));
    expect(onValueChange).toHaveBeenCalledWith("10");
  });
});
