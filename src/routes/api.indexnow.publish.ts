import { createFileRoute } from "@tanstack/react-router";
import {
  isAuthorizedIndexNowRequest,
  type IndexNowReason,
  reconcileIndexNow,
} from "@/services/indexnow/server";

const acceptedReasons = new Set<IndexNowReason>([
  "publish",
  "update",
  "delete",
  "deploy",
  "manual",
  "reconcile",
]);

export const Route = createFileRoute("/api/indexnow/publish")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.INDEXNOW_TRIGGER_SECRET ?? "";
        if (secret.length < 32) {
          return Response.json({ error: "IndexNow trigger is not configured" }, { status: 503 });
        }
        if (!isAuthorizedIndexNowRequest(request, secret)) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const length = Number(request.headers.get("content-length") ?? 0);
        if (Number.isFinite(length) && length > 1024) {
          return Response.json({ error: "Request body is too large" }, { status: 413 });
        }

        let reason: IndexNowReason = "reconcile";
        try {
          const rawBody = await request.text();
          if (rawBody.length > 1024) {
            return Response.json({ error: "Request body is too large" }, { status: 413 });
          }
          const body = JSON.parse(rawBody) as { reason?: unknown };
          if (typeof body !== "object" || body === null || Array.isArray(body)) {
            return Response.json({ error: "Invalid JSON request" }, { status: 400 });
          }
          if (body.reason !== undefined) {
            if (
              typeof body.reason !== "string" ||
              !acceptedReasons.has(body.reason as IndexNowReason)
            ) {
              return Response.json({ error: "Invalid reconciliation reason" }, { status: 400 });
            }
            reason = body.reason as IndexNowReason;
          }
        } catch {
          return Response.json({ error: "Invalid JSON request" }, { status: 400 });
        }

        try {
          const result = await reconcileIndexNow(reason);
          return Response.json(result, { status: 200 });
        } catch {
          return Response.json({ error: "IndexNow reconciliation failed" }, { status: 500 });
        }
      },
    },
  },
});
