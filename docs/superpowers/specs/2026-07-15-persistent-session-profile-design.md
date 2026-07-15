# Persistent Session and Google Profile Design

## Objective

Keep a valid Supabase session active until the user signs out or Supabase revokes it, make every production entry point converge on the canonical origin, and present the authenticated user's Google name and profile photo consistently.

## Confirmed Cause

- Supabase already issues persistent refresh-token cookies. A production session remained valid across browser tabs and overnight on `https://vid-story-prompt.vercel.app`.
- Vercel's additional production aliases are separate origins and cannot read the canonical host's cookies. Visiting an alias therefore appears to sign the user out.
- Marketing navigation always renders `Log in` and `Start editing`, even when the session is valid, and the login/signup routes do not redirect authenticated users to the workspace.
- Google metadata is available in `auth.users`, but the profile bootstrap only copies `display_name`; it does not reliably copy Google's `full_name`/`name` or `avatar_url`/`picture` fields.

## Selected Design

### Canonical production origin

The server entry checks production GET and HEAD requests before rendering. When the request origin differs from `PUBLIC_APP_URL`, it returns a permanent redirect to the canonical origin while preserving the path and query string. Preview and local environments are unaffected. Non-idempotent requests are not redirected.

### Session-aware public authentication UX

The shared session hook exposes both the current user and a loading state. Marketing navigation keeps authentication actions neutral while loading, shows `Log in` and `Start editing` when signed out, and shows the user's avatar/name with an `Open workspace` action when signed in.

Authenticated visitors to `/login` or `/signup` are redirected to a safe local destination (or `/app`) before the form renders. This prevents a valid session from looking like a logout.

### Google profile metadata

The profile bootstrap function selects a display name from `display_name`, `full_name`, `name`, then the email prefix. It selects an avatar from `avatar_url` or `picture`. A migration backfills existing Google users only when their current display name is blank or still the generated email prefix, and only fills a missing avatar so user edits remain authoritative.

The workspace sidebar uses the shared Avatar component to render the Google image with a deterministic initials fallback. The full name and email remain visible in the expanded sidebar; the collapsed sidebar retains an accessible account label.

## Failure and Security Behavior

- Missing or invalid `PUBLIC_APP_URL` skips canonicalization rather than producing a redirect loop.
- Redirect destinations reuse only the configured canonical origin plus the incoming path/query.
- Profile image failures fall back to initials without blocking navigation.
- Only public Google profile metadata is stored; OAuth tokens and secrets remain server-only.
- Signing out clears the Supabase session and returns the user to `/login`.

## Verification

1. Unit-test canonical redirects, canonical requests, previews, unsafe methods, and path/query preservation.
2. Unit-test Google metadata name/avatar selection and preservation rules.
3. Test marketing navigation for loading, signed-out, and signed-in states, including avatar fallback.
4. Run typecheck, lint, unit/integration tests, production build, worker checks, and relevant Playwright tests.
5. Deploy the database migration and application.
6. In production, verify login, refresh, a newly opened tab, `/login` while authenticated, canonical home navigation, alternate production aliases, name/avatar rendering, and explicit logout.
