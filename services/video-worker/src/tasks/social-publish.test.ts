import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.SUPABASE_URL = "https://worker-test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "worker-test-service-role-key-long-enough";
  process.env.LINKEDIN_API_VERSION = "202605";
});

import { linkedinHeaders, tiktokPostBody } from "./social-publish.js";

describe("social publishing provider contracts", () => {
  it("pins the required LinkedIn protocol and marketing version headers", () => {
    expect(linkedinHeaders("token-value")).toMatchObject({
      authorization: "Bearer token-value",
      "linkedin-version": "202605",
      "x-restli-protocol-version": "2.0.0",
    });
  });

  it("maps review settings into TikTok's direct-post request", () => {
    expect(
      tiktokPostBody(
        {
          caption: "A reviewed caption",
          title: "Fallback title",
          platform_options_json: {
            disableComment: true,
            disableDuet: false,
            disableStitch: true,
          },
        },
        "SELF_ONLY",
      ),
    ).toEqual({
      post_info: {
        title: "A reviewed caption",
        privacy_level: "SELF_ONLY",
        disable_comment: true,
        disable_duet: false,
        disable_stitch: true,
      },
    });
  });
});
