type CanonicalRedirectOptions = {
  isProduction: boolean;
  publicAppUrl?: string;
};

export function canonicalProductionRedirect(
  request: Request,
  { isProduction, publicAppUrl }: CanonicalRedirectOptions,
) {
  if (!isProduction || !publicAppUrl || !["GET", "HEAD"].includes(request.method)) return null;

  let canonical: URL;
  try {
    canonical = new URL(publicAppUrl);
  } catch {
    return null;
  }

  if (!["http:", "https:"].includes(canonical.protocol)) return null;

  const current = new URL(request.url);
  if (current.origin === canonical.origin) return null;

  const destination = new URL(`${current.pathname}${current.search}`, canonical);
  return Response.redirect(destination, 308);
}
