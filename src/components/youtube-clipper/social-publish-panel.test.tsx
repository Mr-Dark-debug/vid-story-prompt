import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AnchorHTMLAttributes } from "react";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
  useRouter: () => ({ invalidate: vi.fn() }),
}));

import { SocialPublishPanel } from "./social-publish-panel";

afterEach(() => cleanup());

describe("social publishing review boundary", () => {
  it("does not offer a fake publish action without a connected destination", () => {
    render(
      <SocialPublishPanel
        exports={[{ id: crypto.randomUUID(), status: "complete", export_type: "single_clip" }]}
        destinations={[]}
        jobs={[]}
        configuredPlatforms={["tiktok"]}
        defaultTitle="Reviewed clip"
      />,
    );
    expect(screen.getByText("Ready to connect")).toBeInTheDocument();
    expect(screen.getAllByText("Credentials required")).toHaveLength(3);
    expect(screen.queryByRole("button", { name: /confirm and send/i })).not.toBeInTheDocument();
    expect(screen.getByText(/no post is simulated/i)).toBeInTheDocument();
  });
});
