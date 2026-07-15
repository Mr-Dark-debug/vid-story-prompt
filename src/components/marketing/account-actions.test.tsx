import { cleanup, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MarketingAccountActions } from "./account-actions";

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

const googleUser = {
  id: "user-1",
  email: "avery@example.com",
  name: "Avery Editor",
  avatarUrl: "https://example.com/avatar.jpg",
  plan: "free",
  workspaceId: "workspace-1",
  workspaceRole: "owner",
};

afterEach(cleanup);

describe("MarketingAccountActions", () => {
  it("shows a loader while the persistent session is being checked", () => {
    render(<MarketingAccountActions user={null} isLoading />);
    expect(screen.getByRole("status", { name: "Checking your account" })).toBeInTheDocument();
  });

  it("shows login and signup actions when signed out", () => {
    render(<MarketingAccountActions user={null} isLoading={false} />);
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "Start editing" })).toHaveAttribute("href", "/signup");
  });

  it("shows the Google profile and workspace action when signed in", () => {
    render(<MarketingAccountActions user={googleUser} isLoading={false} />);
    expect(screen.getByText("Avery Editor")).toBeInTheDocument();
    expect(screen.getByLabelText("Avery Editor profile")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open workspace" })).toHaveAttribute("href", "/app");
    expect(screen.queryByRole("link", { name: "Log in" })).not.toBeInTheDocument();
  });
});
