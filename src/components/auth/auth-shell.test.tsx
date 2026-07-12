import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GoogleAuthButton } from "./auth-shell";

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
});
