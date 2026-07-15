import { describe, expect, it } from "vitest";
import { canonicalProductionRedirect } from "./canonical-origin";

const options = {
  isProduction: true,
  publicAppUrl: "https://vidrial.vercel.app",
};

describe("canonicalProductionRedirect", () => {
  it("redirects an alternate production origin and preserves path and query", () => {
    const response = canonicalProductionRedirect(
      new Request("https://vid-story-prompt-prashant-project.vercel.app/app/projects?view=grid"),
      options,
    );

    expect(response?.status).toBe(308);
    expect(response?.headers.get("location")).toBe(
      "https://vidrial.vercel.app/app/projects?view=grid",
    );
  });

  it("does not redirect the canonical origin", () => {
    expect(
      canonicalProductionRedirect(new Request("https://vidrial.vercel.app/app"), options),
    ).toBeNull();
  });

  it("redirects the previous production alias to the canonical origin", () => {
    const response = canonicalProductionRedirect(
      new Request("https://vid-story-prompt.vercel.app/app/youtube-clipper/new"),
      options,
    );

    expect(response?.status).toBe(308);
    expect(response?.headers.get("location")).toBe(
      "https://vidrial.vercel.app/app/youtube-clipper/new",
    );
  });

  it("does not redirect preview or local environments", () => {
    expect(
      canonicalProductionRedirect(new Request("https://preview.example/app"), {
        ...options,
        isProduction: false,
      }),
    ).toBeNull();
  });

  it("does not replay non-idempotent requests across origins", () => {
    expect(
      canonicalProductionRedirect(
        new Request("https://alternate.example/_serverFn/auth", { method: "POST" }),
        options,
      ),
    ).toBeNull();
  });

  it("fails safely when the canonical origin is invalid", () => {
    expect(
      canonicalProductionRedirect(new Request("https://alternate.example/app"), {
        isProduction: true,
        publicAppUrl: "not a URL",
      }),
    ).toBeNull();
  });
});
