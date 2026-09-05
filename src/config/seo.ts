export const SEO_ORIGIN = "https://vidrial.vercel.app" as const;

export const SEO_SITE_NAME = "Vidrial" as const;
export const SEO_EDITORIAL_AUTHOR = "Vidrial Editorial Team" as const;
export const SEO_DEFAULT_DESCRIPTION =
  "Turn authorised long-form video into explainable, editable short clips with AI-assisted planning, captions and reframing." as const;
export const SEO_DEFAULT_SOCIAL_IMAGE = "/social/vidrial-social-card.png" as const;

export function absoluteUrl(path: string): string {
  const value = new URL(path, `${SEO_ORIGIN}/`);

  if (value.origin !== SEO_ORIGIN) {
    throw new Error(`Canonical URL must use ${SEO_ORIGIN}`);
  }

  return value.toString();
}

export type VerificationTokens = {
  google?: string;
  bing?: string;
};

export function verificationMeta(tokens: VerificationTokens) {
  const google = tokens.google?.trim();
  const bing = tokens.bing?.trim();

  return [
    ...(google ? [{ name: "google-site-verification", content: google }] : []),
    ...(bing ? [{ name: "msvalidate.01", content: bing }] : []),
  ];
}

export type PageMetaOptions = {
  title: string;
  description: string;
  path: string;
  robots?: "index,follow" | "noindex,nofollow";
  type?: "website" | "article";
  imagePath?: string;
};

export function pageMeta({
  title,
  description,
  path,
  robots = "index,follow",
  type = "website",
  imagePath = SEO_DEFAULT_SOCIAL_IMAGE,
}: PageMetaOptions) {
  const canonical = absoluteUrl(path);
  const image = absoluteUrl(imagePath);

  return {
    meta: [
      { title },
      { name: "description", content: description },
      { name: "robots", content: robots },
      { property: "og:site_name", content: SEO_SITE_NAME },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: type },
      { property: "og:url", content: canonical },
      { property: "og:image", content: image },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: `${SEO_SITE_NAME} — AI-assisted video clipping` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: image },
      { name: "twitter:image:alt", content: `${SEO_SITE_NAME} — AI-assisted video clipping` },
    ],
    links: [{ rel: "canonical", href: canonical }],
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": absoluteUrl("/#organization"),
    name: SEO_SITE_NAME,
    url: absoluteUrl("/"),
    logo: absoluteUrl("/favicon.svg"),
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": absoluteUrl("/#website"),
    name: SEO_SITE_NAME,
    url: absoluteUrl("/"),
    publisher: { "@id": absoluteUrl("/#organization") },
    inLanguage: "en",
  };
}

/** Serialize JSON-LD safely for an inline application/ld+json script. */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}
