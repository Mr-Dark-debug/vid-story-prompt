import { createFileRoute } from "@tanstack/react-router";
import {
  completeRelayRequest,
  failRelayRequest,
  heartbeatRelayRequest,
  leaseRelayRequest,
  pairRelayDevice,
} from "@/services/acquisition/relay.server";

async function body(request: Request) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 64 * 1024) throw new Error("Request body is too large.");
  return request.json();
}

export const Route = createFileRoute("/api/acquisition/relay/$action")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        try {
          const action = (params as { action: string }).action;
          const result =
            action === "pair"
              ? await pairRelayDevice(await body(request))
              : action === "lease"
                ? await leaseRelayRequest(request)
                : action === "heartbeat"
                  ? await heartbeatRelayRequest(request, await body(request))
                  : action === "complete"
                    ? await completeRelayRequest(request, await body(request))
                    : action === "fail"
                      ? await failRelayRequest(request, await body(request))
                      : undefined;
          if (result === undefined) return Response.json({ error: "Not found" }, { status: 404 });
          return Response.json(result, { status: 200, headers: { "cache-control": "no-store" } });
        } catch {
          return Response.json({ error: "Relay request rejected" }, { status: 400 });
        }
      },
    },
  },
});
