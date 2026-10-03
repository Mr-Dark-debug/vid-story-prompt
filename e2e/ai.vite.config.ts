import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

const file = (path: string) => fileURLToPath(new URL(path, import.meta.url));

/**
 * FAKE PROVIDER BOUNDARY. This dev-only middleware stands in for Vidrial's `/api/ai/chat` route and
 * for the model provider behind it. It streams a canned reply so the browser UI (streaming, Stop,
 * Regenerate, error states) can be exercised. It proves nothing about real providers, real keys,
 * Supabase persistence or the production route handler (those are covered by unit tests and
 * need live verification).
 */
function fakeChatEndpoint(): Plugin {
  let take = 0;
  return {
    name: "fake-ai-chat-endpoint",
    configureServer(server) {
      // Lets each test start from a known state even when the dev server is reused.
      server.middlewares.use("/__fixture/reset", (_request, response) => {
        take = 0;
        response.statusCode = 204;
        response.end();
      });
      server.middlewares.use("/api/ai/chat", (request, response) => {
        if (request.method !== "POST") {
          response.statusCode = 405;
          response.end();
          return;
        }
        let raw = "";
        request.on("data", (chunk) => (raw += chunk));
        request.on("end", () => {
          const body = JSON.parse(raw || "{}") as { turn?: { kind?: string; content?: string } };
          if (body.turn?.content?.includes("FORCE_BUSY")) {
            response.statusCode = 409;
            response.setHeader("content-type", "application/json");
            response.end(
              JSON.stringify({ error: "This chat is still generating a reply.", code: "busy" }),
            );
            return;
          }
          take += 1;
          const words =
            `Here are three hook ideas for take ${take}: start with the result, name the stakes, then show the turning point.`.split(
              " ",
            );
          response.writeHead(200, {
            "content-type": "text/event-stream",
            "cache-control": "no-store",
          });
          const send = (event: unknown) => response.write(`data: ${JSON.stringify(event)}\n\n`);
          send({
            type: "start",
            threadId: "t-fixture",
            userMessageId: `u-${take}`,
            assistantMessageId: `a-${take}`,
            title: "Hook ideas",
          });
          let index = 0;
          const timer = setInterval(() => {
            if (index < words.length) {
              send({ type: "delta", text: `${index === 0 ? "" : " "}${words[index++]}` });
              return;
            }
            clearInterval(timer);
            send({
              type: "done",
              usage: { inputTokens: 42, outputTokens: words.length * 2 },
              finishReason: "stop",
            });
            response.end();
          }, 120);
          // Client closed (Stop or navigation): stop producing.
          response.on("close", () => clearInterval(timer));
        });
      });
    },
  };
}

export default defineConfig({
  root: file("./ai-fixture"),
  cacheDir: file("../node_modules/.vite-ai-e2e"),
  envDir: false,
  plugins: [react(), tailwind(), fakeChatEndpoint()],
  resolve: {
    alias: [
      {
        find: /^@\/services\/ai\/(?:server|threads|runs)$/,
        replacement: file("./ai-fixture/providers.ts"),
      },
      { find: "@tanstack/react-router", replacement: file("./ai-fixture/router.tsx") },
      { find: "@", replacement: file("../src") },
    ],
  },
  server: { host: "127.0.0.1", port: 4175, strictPort: true, fs: { allow: [file("..")] } },
});
