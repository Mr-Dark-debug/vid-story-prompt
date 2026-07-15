import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { finishConnectorConnection } from "@/services/connectors/oauth.server";

const connectorSchema = z.enum(["google_drive", "dropbox", "onedrive"]);

export const Route = createFileRoute("/auth/connectors/$connectorId/callback")({
  validateSearch: z.object({
    code: z.string().optional(),
    state: z.string().optional(),
    error: z.string().optional(),
  }),
  beforeLoad: async ({ params, search }) => {
    const connectorId = connectorSchema.safeParse(params.connectorId);
    if (!connectorId.success || search.error || !search.code || !search.state)
      throw redirect({
        to: "/app/settings/integrations",
        search: {
          youtubeError: "The source connection was not authorised. You can retry when ready.",
        },
      });
    try {
      const result = await finishConnectorConnection({
        data: { connectorId: connectorId.data, code: search.code, state: search.state },
      });
      throw redirect({ href: result.returnTo });
    } catch (cause) {
      if (cause && typeof cause === "object" && "isRedirect" in cause) throw cause;
      throw redirect({
        to: "/app/settings/integrations",
        search: {
          youtubeError:
            cause instanceof Error
              ? cause.message.slice(0, 240)
              : "The source connection could not be completed.",
        },
      });
    }
  },
  component: () => null,
});
