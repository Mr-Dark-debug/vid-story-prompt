import { createFileRoute } from "@tanstack/react-router";
import { absoluteUrl } from "@/config/seo";
import { loadPublicMotionCatalog } from "@/services/motion/public";

export const Route = createFileRoute("/sitemap-motion.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { prompts } = await loadPublicMotionCatalog();
        const entries = prompts
          .map((prompt) => {
            const url = absoluteUrl(`/prompts/${encodeURIComponent(prompt.slug)}`);
            return `<url><loc>${url.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</loc></url>`;
          })
          .join("\n");
        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`,
          {
            headers: {
              "content-type": "application/xml; charset=utf-8",
              "cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
              "x-content-type-options": "nosniff",
            },
          },
        );
      },
    },
  },
});
