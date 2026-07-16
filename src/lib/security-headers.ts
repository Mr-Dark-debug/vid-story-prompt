const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://vercel.live",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://vercel.live",
  "font-src 'self' data: https://fonts.gstatic.com https://vercel.live https://assets.vercel.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://www.googleapis.com https://oauth2.googleapis.com https://challenges.cloudflare.com https://vidrial-video-worker.onrender.com https://vercel.live wss://ws-us3.pusher.com",
  "frame-src https://challenges.cloudflare.com https://accounts.google.com https://vercel.live",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

export function withSecurityHeaders(response: Response) {
  const headers = new Headers(response.headers);
  headers.set("Content-Security-Policy", contentSecurityPolicy);
  headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  );
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
