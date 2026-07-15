import { describe, expect, it } from "vitest";
import { resolveAuthProfile } from "./profile";

describe("resolveAuthProfile", () => {
  it("uses Google name and picture when the stored profile is still generated", () => {
    expect(
      resolveAuthProfile(
        {
          email: "editor@example.com",
          user_metadata: {
            full_name: "Avery Editor",
            picture: "https://example.com/avery.jpg",
          },
        },
        { display_name: "editor", avatar_url: null },
      ),
    ).toEqual({
      name: "Avery Editor",
      avatarUrl: "https://example.com/avery.jpg",
    });
  });

  it("preserves a user-edited display name and avatar", () => {
    expect(
      resolveAuthProfile(
        {
          email: "editor@example.com",
          user_metadata: { full_name: "Google Name", picture: "https://example.com/google.jpg" },
        },
        { display_name: "Studio Owner", avatar_url: "https://example.com/custom.jpg" },
      ),
    ).toEqual({
      name: "Studio Owner",
      avatarUrl: "https://example.com/custom.jpg",
    });
  });

  it("falls back to the email prefix without provider metadata", () => {
    expect(resolveAuthProfile({ email: "creator@example.com" })).toEqual({
      name: "creator",
      avatarUrl: null,
    });
  });

  it("rejects non-web avatar URLs", () => {
    expect(
      resolveAuthProfile({
        email: "creator@example.com",
        user_metadata: { picture: "javascript:alert(1)" },
      }).avatarUrl,
    ).toBeNull();
  });
});
