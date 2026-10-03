import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect } from "react";
import { MarketingLayout } from "@/components/marketing/layout";
import { Container } from "@/components/primitives/section";
import { MotionPromptEmbed, MotionPromptReport } from "@/components/motion/public-gallery";
import { MotionPublicPage, MotionDisclaimer } from "@/components/motion/public-page";
import { motionCollections } from "@/services/motion/catalog";
import { loadPublicMotionCatalog, recordPublicMotionEvent } from "@/services/motion/public";
import { pageMeta } from "@/config/seo";

export const Route = createFileRoute("/prompts/$slug")({
  loader: async ({ params }) => {
    const catalog = await loadPublicMotionCatalog();
    const collection = motionCollections.find((c) => c.slug === params.slug);
    const prompt = catalog.prompts.find((p) => p.slug === params.slug);
    if (!collection && !prompt) throw notFound();
    return { ...catalog, collection, prompt };
  },
  head: ({ loaderData, params }) =>
    pageMeta({
      title: `${loaderData?.collection?.title ?? loaderData?.prompt?.title ?? "Motion prompt"} — Vidrial`,
      description:
        loaderData?.collection?.description ??
        loaderData?.prompt?.description ??
        "Copy an original HTML motion graphics brief and adapt it in Vidrial Motion Studio.",
      path: `/prompts/${params.slug}`,
    }),
  component: PromptPage,
});

function PromptPage() {
  const data = Route.useLoaderData();
  useEffect(() => {
    if (data.prompt) void recordPublicMotionEvent(data.prompt, "view").catch(() => {});
  }, [data.prompt]);
  if (data.collection)
    return (
      <MotionPublicPage
        {...data}
        collectionTitle={data.collection.title}
        collectionDescription={data.collection.description}
      />
    );
  if (!data.prompt) return null;
  return (
    <MarketingLayout>
      <Container className="max-w-4xl py-12">
        <p className="text-sm text-ink-mute">Original HTML motion graphics brief</p>
        <h1 className="mt-3 text-4xl font-semibold leading-tight text-ink">{data.prompt.title}</h1>
        <p className="mt-5 text-lg leading-relaxed text-ink-soft">{data.prompt.description}</p>
        <p className="mt-4 text-sm text-ink-mute">
          By {data.prompt.authorDisplayName} · {data.prompt.createdAt.slice(0, 10)}
        </p>
        <MotionPromptEmbed prompt={data.prompt} />
        <MotionPromptReport prompt={data.prompt} />
        <MotionDisclaimer />
      </Container>
    </MarketingLayout>
  );
}
