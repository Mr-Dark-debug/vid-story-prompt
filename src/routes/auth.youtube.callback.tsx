import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { finishYouTubeConnection } from "@/services/youtube/oauth.server";
import { youtubeOAuthErrorMessage } from "@/services/youtube/oauth-errors";

export const Route = createFileRoute("/auth/youtube/callback")({
  validateSearch: z.object({
    code: z.string().optional(),
    state: z.string().optional(),
    error: z.string().optional(),
  }),
  beforeLoad: async ({ search }) => {
    if (search.error || !search.code || !search.state)
      throw redirect({
        to: "/app/settings/integrations",
        search: { youtubeError: youtubeOAuthErrorMessage(search.error) },
      });
    let result: Awaited<ReturnType<typeof finishYouTubeConnection>>;
    try {
      result = await finishYouTubeConnection({
        data: { code: search.code, state: search.state },
      });
    } catch (cause) {
      throw redirect({
        to: "/app/settings/integrations",
        search: {
          youtubeError:
            cause instanceof Error
              ? cause.message
              : "YouTube connection failed. Start the connection again.",
        },
      });
    }
    throw redirect({ href: result.returnTo });
  },
  component: () => null,
});
