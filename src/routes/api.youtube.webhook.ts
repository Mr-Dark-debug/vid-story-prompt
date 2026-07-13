import { createFileRoute } from "@tanstack/react-router";
import { handleYouTubeNotification, verifyWebSubChallenge } from "@/services/youtube/websub.server";

export const Route = createFileRoute("/api/youtube/webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const challenge = url.searchParams.get("hub.challenge");
        const topic = url.searchParams.get("hub.topic");
        const mode = url.searchParams.get("hub.mode");
        const callbackKey = url.searchParams.get("key");
        if (!challenge || !topic || !mode || !callbackKey)
          return new Response("Invalid verification request", { status: 400 });
        const leaseValue = Number(url.searchParams.get("hub.lease_seconds"));
        const valid = await verifyWebSubChallenge({
          callbackKey,
          topic,
          mode,
          leaseSeconds: Number.isFinite(leaseValue) && leaseValue > 0 ? leaseValue : null,
        });
        return valid
          ? new Response(challenge, { status: 200, headers: { "content-type": "text/plain" } })
          : new Response("Verification rejected", { status: 404 });
      },
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const callbackKey = url.searchParams.get("key");
        const length = Number(request.headers.get("content-length") ?? 0);
        if (!callbackKey || (length > 0 && length > 256 * 1024))
          return new Response("Invalid notification", { status: 400 });
        const body = await request.text();
        try {
          await handleYouTubeNotification({
            callbackKey,
            body,
            signature: request.headers.get("x-hub-signature"),
          });
          return new Response(null, { status: 204 });
        } catch {
          return new Response("Notification rejected", { status: 400 });
        }
      },
    },
  },
});
