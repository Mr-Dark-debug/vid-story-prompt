# Google OAuth Signup and Turnstile Design

## Objective

Make Google and email signup reliable, visibly protected by Cloudflare Turnstile, and diagnosable without exposing OAuth codes, tokens, secrets, email addresses, or other private authentication data.

## Findings

- Google signup does not depend on the Render video worker. The production OAuth request correctly uses the Supabase callback at `https://vifcdussqjhvhurxzdwq.supabase.co/auth/v1/callback`.
- Supabase reports that Google authentication and account creation are enabled.
- The reported `Unable to exchange external code` failure therefore points to the Google provider credential stored in Supabase, most likely a stale or mismatched client secret.
- Turnstile currently protects YouTube metadata requests but is not rendered or enforced during signup.
- The worker already has authenticated wake-on-demand and durable queue recovery. A permanent self-ping would consume free-instance hours without improving authentication.

## Selected Architecture

### Shared Turnstile verification

Move Turnstile verification into a server-only security service. Callers provide an allow-listed action such as `signup` or `youtube_metadata`. Verification requires the public site key and secret to be configured as a pair, sends the token and request IP to Cloudflare, validates success, action, and production hostname, and returns only user-safe errors.

### Visible signup challenge

Generalize the existing widget so each surface supplies its action and appearance. Signup uses the managed widget with an always-visible verification container, accessible status text, expiration/error handling, and token reset after every failed submission. Both email signup and the Google signup button remain disabled until verification succeeds when production Turnstile is configured.

Email signup sends the token to the server before creating the account. Google signup sends the token before generating the Supabase OAuth URL. Login remains available without signup Turnstile so existing users are not locked out; rate limiting and Supabase protections remain separate concerns.

### OAuth configuration and diagnostics

Synchronize the active Google Web OAuth client ID and secret from Google Console into the Supabase Google provider. Google Console retains the Supabase callback as its authorized redirect URI. Supabase retains the canonical application callback in its redirect allow-list.

Add structured authentication diagnostics at external boundaries. Logs contain only a fixed stage, provider, sanitized error code, and numeric status. They never include OAuth authorization codes, access/refresh tokens, client secrets, raw callback URLs, email addresses, or provider error descriptions.

### Worker cold starts

Keep the existing authenticated `/wake` request after queue insertion and the durable Supabase queue/lease recovery model. Do not add continuous keep-alive traffic. A wake failure leaves work queued and is represented as a recoverable startup delay rather than an authentication failure.

## Failure Handling

- Missing signup verification produces a focused message and leaves account creation untouched.
- Expired, duplicate, wrong-action, wrong-hostname, or rejected tokens reset the widget and allow retry.
- A Turnstile network timeout produces a temporary verification error rather than bypassing protection.
- Google OAuth configuration failures return a friendly login-page error and emit a sanitized server diagnostic.
- OAuth callback destinations accept only local application paths and reject protocol-relative redirects.
- If the Turnstile site key and secret are intentionally absent together, local development continues without the widget. Partial configuration fails closed.

## Verification

1. Unit-test Turnstile success, rejection, action mismatch, hostname mismatch, timeout, and partial configuration.
2. Unit-test signup validators and safe OAuth diagnostic sanitization.
3. Run application typecheck, lint, tests, and production build; run worker typecheck and tests.
4. Verify the deployed signup page renders the Turnstile container on desktop and mobile.
5. Verify email signup and Google OAuth cannot start before verification and can start after a valid token.
6. Complete a controlled Google OAuth signup and confirm profile/workspace bootstrap.
7. Confirm production browser console cleanliness, security headers, and sanitized runtime logs.
8. Confirm the worker `/healthz` and authenticated wake behavior without continuous pings.

## Security Invariants

- Browser code receives only the Turnstile site key and Supabase publishable key.
- Turnstile, Google, Supabase service-role, worker wake, and AI-provider secrets remain server-side.
- OAuth codes and provider tokens never enter application logs or analytics.
- Signup verification is checked server-side and cannot be bypassed by enabling a browser button manually.
- Render worker availability cannot weaken or block authentication.
