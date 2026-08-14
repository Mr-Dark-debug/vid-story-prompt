import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase/server";

const articleSlug = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const blogFeedbackInputSchema = z.object({
  slug: articleSlug,
  vote: z.enum(["helpful", "not_helpful"]),
  anonymousSessionId: z.string().uuid(),
});

export type BlogFeedbackInput = z.infer<typeof blogFeedbackInputSchema>;

type RpcError = { message?: string };

export type BlogFeedbackRpcClient = {
  rpc(
    name: "submit_blog_feedback",
    params: {
      p_article_slug: string;
      p_vote: BlogFeedbackInput["vote"];
      p_user_id: string | null;
      p_anonymous_session_id: string;
    },
  ): PromiseLike<{ data: unknown; error: RpcError | null }>;
};

type BlogFeedbackDependencies = {
  getClient: () => BlogFeedbackRpcClient;
  getUserId?: () => Promise<string | null>;
};

const SAFE_FAILURE_MESSAGE = "Feedback could not be saved. Please try again.";

export class BlogFeedbackSubmissionError extends Error {
  constructor() {
    super(SAFE_FAILURE_MESSAGE);
    this.name = "BlogFeedbackSubmissionError";
  }
}

export async function submitBlogFeedbackWithDependencies(
  input: BlogFeedbackInput,
  dependencies: BlogFeedbackDependencies,
): Promise<{ accepted: true }> {
  const parsed = blogFeedbackInputSchema.parse(input);

  try {
    const userId = dependencies.getUserId ? await dependencies.getUserId() : null;
    const { data, error } = await dependencies.getClient().rpc("submit_blog_feedback", {
      p_article_slug: parsed.slug,
      p_vote: parsed.vote,
      p_user_id: userId,
      p_anonymous_session_id: parsed.anonymousSessionId,
    });

    if (error || !isAcceptedResponse(data)) throw new BlogFeedbackSubmissionError();
    return { accepted: true };
  } catch (error) {
    if (error instanceof BlogFeedbackSubmissionError) throw error;
    throw new BlogFeedbackSubmissionError();
  }
}

function isAcceptedResponse(value: unknown): value is { accepted: true } {
  return (
    typeof value === "object" && value !== null && "accepted" in value && value.accepted === true
  );
}

export const submitBlogFeedback = createServerFn({ method: "POST" })
  .validator(blogFeedbackInputSchema)
  .handler(async ({ data }) => {
    const { getPublishedArticle } = await import("@/features/blog/repository.server");
    if (!getPublishedArticle(data.slug)) throw new BlogFeedbackSubmissionError();
    return submitBlogFeedbackWithDependencies(data, {
      getClient: () => getSupabaseAdminClient() as unknown as BlogFeedbackRpcClient,
      getUserId: async () => {
        const { data: auth } = await getSupabaseServerClient().auth.getUser();
        return auth.user?.id ?? null;
      },
    });
  });
