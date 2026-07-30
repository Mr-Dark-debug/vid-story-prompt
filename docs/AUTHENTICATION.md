# Authentication configuration

Vidrial uses Supabase Auth for email/password and Google sign-in. Google sign-in and the optional YouTube ownership connection are separate OAuth flows:

- Supabase Google sign-in requests only `openid email profile` and returns through Supabase.
- YouTube ownership verification requests `youtube.readonly` and returns directly to Vidrial.

## Google Cloud

Create a Web application OAuth client and configure these production redirect URIs:

```text
https://vifcdussqjhvhurxzdwq.supabase.co/auth/v1/callback
https://vidrial.vercel.app/auth/youtube/callback
```

For local development, also allow:

```text
http://localhost:3000
http://localhost:3000/auth/youtube/callback
```

Enable YouTube Data API v3. Create a server-side API key restricted to YouTube Data API v3. Do not expose the OAuth client secret or metadata API key in browser-prefixed variables.

## Supabase

Under Authentication → Sign In / Providers → Google:

1. Enable Google.
2. Add the Google Web client ID and client secret.
3. Keep nonce skipping disabled.
4. Keep users-without-email disabled.

Set the Site URL to the production application URL and allow these redirects:

```text
https://vidrial.vercel.app/**
http://localhost:3000/**
```

## Application and Vercel

Public build variables:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Server-only variables:

```text
PUBLIC_APP_URL
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY
YOUTUBE_API_KEY
TURNSTILE_SECRET_KEY
TURNSTILE_ALLOWED_HOSTNAMES
```

Browser-visible Turnstile configuration:

```text
VITE_TURNSTILE_SITE_KEY
```

Vidrial explicitly renders Cloudflare Turnstile in managed `interaction-only` mode on both log-in
and sign-up. Normal visitors receive a token automatically and only see a small completed status;
the challenge expands when Cloudflare requires interaction. Password and Google entry points stay
disabled until a fresh token exists. Errors, timeouts, and five-minute token expiry clear the token
and use Cloudflare's automatic retry/refresh behavior.

The TanStack server validates every token with Cloudflare Siteverify before calling Supabase Auth.
It also requires the exact `login` or `signup` action and an allowed hostname. Tokens are never
logged or returned in application errors. Because a Turnstile token is single-use, do not also
enable Supabase's native CAPTCHA verification for these same calls unless the integration is
changed to let Supabase be the sole verifier; double verification will reject the already-consumed
token.

`GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY` must contain at least 32 random characters. Store all server-only values as encrypted hosting secrets. Never commit them or prefix them with `VITE_`.

Set `PUBLIC_APP_URL=https://vidrial.vercel.app`. Production requests received on another Vercel alias, including the previous `vid-story-prompt.vercel.app` hostname, are redirected to this canonical origin before the application renders so the Supabase session cookie stays on one hostname.

When changing the production hostname, update Google redirect URIs, Supabase Site URL/redirect allowlist, `PUBLIC_APP_URL`, and then redeploy.
