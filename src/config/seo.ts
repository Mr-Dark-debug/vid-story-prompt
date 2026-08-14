export const SEO_ORIGIN = "https://vidrial.vercel.app" as const;

export const SEO_SITE_NAME = "Vidrial" as const;
export const SEO_EDITORIAL_AUTHOR = "Vidrial Editorial Team" as const;

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
