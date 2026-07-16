import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AuthShell, GoogleAuthButton } from "./auth-shell";

vi.mock("@/components/primitives/logo", () => ({
  Logo: () => <span>Vidrial</span>,
}));

describe("GoogleAuthButton", () => {
  it("offers an accessible Google sign-in action", async () => {
    const onClick = vi.fn();
    render(<GoogleAuthButton label="Continue with Google" busy={false} onClick={onClick} />);

    await userEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.getByText("or continue with email")).toBeInTheDocument();
  });

  it("prevents duplicate requests while redirecting", () => {
    render(<GoogleAuthButton label="Continue with Google" busy onClick={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Opening Google…" })).toBeDisabled();
  });

  it("can wait for signup security verification", async () => {
    const onClick = vi.fn();
    render(
      <GoogleAuthButton label="Sign up with Google" busy={false} disabled onClick={onClick} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Sign up with Google" }));

    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("AuthShell", () => {
  it("renders the auth experience directly across the viewport", () => {
    render(
      <AuthShell eyebrow="Log in" title="Welcome back" lead="Continue to your workspace.">
        <div>Form fields</div>
      </AuthShell>,
    );

    const main = screen.getByRole("main");
    expect(main).toHaveClass("min-h-dvh", "lg:grid");
    expect(main.querySelector(":scope > aside")).toBeInTheDocument();
    expect(main.querySelector(":scope > section")).toBeInTheDocument();
    expect(main.children).toHaveLength(2);
  });
});
