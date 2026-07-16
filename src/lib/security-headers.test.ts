import { describe, expect, it } from "vitest";
import { withSecurityHeaders } from "./security-headers";

describe("withSecurityHeaders", () => {
  it("preserves the response and applies browser security invariants", async () => {
    const secured = withSecurityHeaders(
      new Response("ok", { status: 201, headers: { "x-existing": "preserved" } }),
    );

    expect(secured.status).toBe(201);
    expect(await secured.text()).toBe("ok");
    expect(secured.headers.get("x-existing")).toBe("preserved");
    expect(secured.headers.get("x-content-type-options")).toBe("nosniff");
    expect(secured.headers.get("x-frame-options")).toBe("DENY");
    expect(secured.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(secured.headers.get("content-security-policy")).toContain(
      "https://challenges.cloudflare.com",
    );
    expect(secured.headers.get("content-security-policy")).toContain(
      "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://vercel.live",
    );
    expect(secured.headers.get("content-security-policy")).toContain(
      "wss://ws-us3.pusher.com",
    );
  });
});
