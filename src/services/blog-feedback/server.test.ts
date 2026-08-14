// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  blogFeedbackInputSchema,
  BlogFeedbackSubmissionError,
  type BlogFeedbackRpcClient,
  submitBlogFeedbackWithDependencies,
} from "./server";

const migration = readFileSync(
  new URL("../../../supabase/migrations/20260731010000_blog_feedback.sql", import.meta.url),
  "utf8",
);

function validInput() {
  return {
    slug: "how-to-turn-long-videos-into-shorts-with-ai",
    vote: "helpful" as const,
    anonymousSessionId: "de305d54-75b4-431b-adb2-eb6b9e546014",
  };
}

function clientResult(data: unknown, error: { message: string } | null = null) {
  const rpc = vi.fn().mockResolvedValue({ data, error });
  return { client: { rpc } as unknown as BlogFeedbackRpcClient, rpc };
}

describe("blog feedback validation", () => {
  it.each([
    { ...validInput(), slug: "../private" },
    { ...validInput(), slug: "Uppercase-Slug" },
    { ...validInput(), slug: "" },
    { ...validInput(), vote: "maybe" },
    { ...validInput(), anonymousSessionId: "session-123" },
  ])("rejects malformed input without calling storage: $slug", (input) => {
    expect(() => blogFeedbackInputSchema.parse(input)).toThrow();
  });

  it("sends only the article, vote, verified user id, and anonymous UUID to the database RPC", async () => {
    const { client, rpc } = clientResult({ accepted: true });

    await expect(
      submitBlogFeedbackWithDependencies(validInput(), { getClient: () => client }),
    ).resolves.toEqual({ accepted: true });

    expect(rpc).toHaveBeenCalledWith("submit_blog_feedback", {
      p_article_slug: validInput().slug,
      p_vote: "helpful",
      p_user_id: null,
      p_anonymous_session_id: validInput().anonymousSessionId,
    });
    expect(JSON.stringify(rpc.mock.calls)).not.toMatch(/email|access_token/i);
  });

  it("passes only the authenticated user id resolved by the server", async () => {
    const { client, rpc } = clientResult({ accepted: true });
    const input = { ...validInput(), vote: "not_helpful" as const };

    await submitBlogFeedbackWithDependencies(input, {
      getClient: () => client,
      getUserId: async () => "2f7c70f7-b4d2-45ba-83fc-88d98fb0c478",
    });

    expect(rpc.mock.calls[0]?.[1]).toHaveProperty(
      "p_user_id",
      "2f7c70f7-b4d2-45ba-83fc-88d98fb0c478",
    );
  });

  it("sanitizes missing configuration and database failures", async () => {
    await expect(
      submitBlogFeedbackWithDependencies(validInput(), {
        getClient: () => {
          throw new Error("SUPABASE_SERVICE_ROLE_KEY=do-not-leak");
        },
      }),
    ).rejects.toEqual(new BlogFeedbackSubmissionError());

    const { client } = clientResult(null, { message: "internal database details" });
    await expect(
      submitBlogFeedbackWithDependencies(validInput(), { getClient: () => client }),
    ).rejects.toThrow("Feedback could not be saved. Please try again.");
  });

  it("rejects a malformed RPC result", async () => {
    const { client } = clientResult({ accepted: false });
    await expect(
      submitBlogFeedbackWithDependencies(validInput(), { getClient: () => client }),
    ).rejects.toBeInstanceOf(BlogFeedbackSubmissionError);
  });
});

describe("blog feedback migration", () => {
  it("enforces votes, one identity, and partial uniqueness", () => {
    expect(migration).toMatch(/vote in \('helpful', 'not_helpful'\)/);
    expect(migration).toMatch(/num_nonnulls\(user_id, anonymous_session_hash\) = 1/);
    expect(migration).toMatch(/where user_id is not null/);
    expect(migration).toMatch(/where user_id is null and anonymous_session_hash is not null/);
  });

  it("hashes anonymous UUIDs inside a security-definer RPC with an empty search path", () => {
    expect(migration).toMatch(/security definer\s+set search_path = ''/);
    expect(migration).toMatch(/digest\(.+p_anonymous_session_id::text.+sha256/s);
    expect(migration).toMatch(/v_user_id uuid := p_user_id/);
  });

  it("blocks public table enumeration while granting only RPC execution", () => {
    expect(migration).toMatch(/alter table public\.blog_feedback enable row level security/);
    expect(migration).toMatch(
      /revoke all on table public\.blog_feedback from public, anon, authenticated/,
    );
    expect(migration).toMatch(
      /grant execute on function public\.submit_blog_feedback\(text, text, uuid, uuid\)\s+to service_role/,
    );
    expect(migration).not.toMatch(
      /grant execute on function public\.submit_blog_feedback\(text, text, uuid, uuid\)\s+to (?:anon|authenticated)/,
    );
    expect(migration).not.toMatch(/grant select[^;]+blog_feedback[^;]+(?:anon|authenticated)/i);
  });
});
