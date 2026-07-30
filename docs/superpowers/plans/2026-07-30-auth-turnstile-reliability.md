# Authentication Turnstile reliability worklog

## Goal

Make security verification on sign-in and sign-up automatic for ordinary visitors, interactive when
Cloudflare requires it, responsive on mobile, and enforced by the TanStack server before any
password or Google authentication attempt.

## Evidence and decisions

- Cloudflare recommends explicit rendering for SPAs and provides `appearance: interaction-only`
  specifically so most visitors never see the challenge.
- Turnstile tokens expire after five minutes and are single-use, so the application clears expired
  tokens and relies on automatic refresh rather than reusing them.
- The previous sign-up route forced `appearance: always`, which was the permanent verification box
  reported by users. The previous sign-in route had no Turnstile enforcement.
- Vidrial remains the sole Siteverify caller. Enabling Supabase native CAPTCHA simultaneously would
  attempt to consume the same token twice.

## Implementation

- Use `interaction-only`, flexible width, automatic retry, automatic expiry refresh, and automatic
  interactive-timeout refresh.
- Show a small checking/completed status for automatic verification; expand the bordered challenge
  area only when interaction is required or an error needs recovery.
- Handle error, timeout, expiry, unsupported-browser, before-interactive, and after-interactive
  callbacks without resetting the widget inside its own callback.
- Require action-bound `login` or `signup` tokens for password and Google entry points on the server.
- Bound script loading to ten seconds and recover from stale script tags instead of hanging forever.

## Verification

- Focused component and Siteverify validation tests: 9 passed.
- TypeScript: passed.
- Real Cloudflare test widget: sign-in and sign-up both changed from checking to verified and enabled
  their actions without manual interaction.
- 360x800 sign-in and sign-up: zero horizontal overflow; both pages visually inspected.
- Production verification remains required after the Vercel deployment.

## Separate production blocker

The YouTube/Python implementation is merged and Vercel is healthy, but the current Render worker
responds with `Service Suspended`. No worker runtime or production clip success is claimed until the
Render account is restored or the worker is moved to another suitable container runtime.
