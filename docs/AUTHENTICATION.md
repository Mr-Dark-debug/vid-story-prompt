# Authentication configuration

Vidrial uses Supabase Auth for email/password and Google sign-in. Google sign-in and the optional YouTube ownership connection are separate OAuth flows:

- Supabase Google sign-in requests only `openid email profile` and returns through Supabase.
- YouTube ownership verification requests `youtube.readonly` and returns directly to Vidrial.

## Google Cloud

Create a Web application OAuth client and configure these production redirect URIs:

```text
https://vifcdussqjhvhurxzdwq.supabase.co/auth/v1/callback
https://vid-story-prompt-prashant-project.vercel.app/auth/youtube/callback
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
https://vid-story-prompt-prashant-project.vercel.app/**
https://vid-story-prompt-mr-dark-debug-prashant-project.vercel.app/**
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
```

`GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY` must contain at least 32 random characters. Store all server-only values as encrypted hosting secrets. Never commit them or prefix them with `VITE_`.

When changing the production hostname, update Google redirect URIs, Supabase Site URL/redirect allowlist, `PUBLIC_APP_URL`, and then redeploy.
