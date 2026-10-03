import { createFileRoute } from "@tanstack/react-router";
import { getServerEnv } from "@/config/env.server";
import { parseCredentialKeyRing } from "@/domain/ai/credential-crypto";
import { getCurrentSession } from "@/services/auth/server";
import { createChatService } from "@/services/ai/chat-service.server";
import { handleChatRequest } from "@/services/ai/chat-stream.server";
import { createSupabaseChatStore } from "@/services/ai/chat-store.server";
import { createCredentialService } from "@/services/ai/credential-service.server";
import { createSupabaseCredentialStore } from "@/services/ai/credential-store.server";

// Streaming chat over Server-Sent Events. The request may end at any time; persistence never
// depends on it surviving (see chat-service.server.ts).
export const Route = createFileRoute("/api/ai/chat")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handleChatRequest(request, {
          authenticate: async () => {
            const session = await getCurrentSession();
            return session?.workspaceId
              ? { userId: session.id, workspaceId: session.workspaceId }
              : null;
          },
          service: createChatService({
            store: createSupabaseChatStore(),
            credentials: createCredentialService({
              store: createSupabaseCredentialStore(),
              keyRing: () => parseCredentialKeyRing(getServerEnv()),
            }),
          }),
        }),
    },
  },
});
