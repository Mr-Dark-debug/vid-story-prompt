import { cleanup, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Logo, LogoMark } from "./logo";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

afterEach(cleanup);

describe("Vidrial logo", () => {
  it("renders an accessible horizontal lockup", () => {
    render(<Logo showTagline />);

    expect(screen.getByRole("link", { name: "Vidrial home" })).toHaveAttribute("href", "/");
    expect(screen.getByText("Vidrial")).toBeInTheDocument();
    expect(screen.getByText("AI-assisted video editing")).toBeInTheDocument();
  });

  it("renders a compact app mark without duplicate visible text", () => {
    render(<Logo to="/app" variant="mark" />);

    expect(screen.getByRole("link", { name: "Vidrial home" })).toHaveAttribute("href", "/app");
    expect(screen.queryByText("Vidrial")).not.toBeInTheDocument();
  });

  it("keeps a standalone decorative mark hidden from assistive technology", () => {
    const { container } = render(<LogoMark tone="light" />);

    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector("svg")).toHaveClass("text-white");
  });
});
