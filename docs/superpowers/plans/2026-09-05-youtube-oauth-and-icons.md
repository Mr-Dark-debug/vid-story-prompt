# YouTube consent restrictions and browser identity

## Confirmed causes

The Google Auth Platform audience page for the existing Vidrial OAuth project reports External/Testing with only one approved test account. Publish app is disabled because branding is incomplete. Application homepage, privacy-policy and terms URLs are blank. This explains Google's developer-approved-testers `403 access_denied`; retrying the same account does not change it.

Google's current guidance distinguishes three different actions:

1. Add an explicitly authorised tester for immediate testing access.
2. Complete branding and publish the external OAuth app to production.
3. Complete the required brand/sensitive-scope verification so users do not see an unverified-app warning. Publishing alone does not mean verification is approved.

References: [Audience restrictions](https://support.google.com/cloud/answer/15549945?hl=en), [verification submission](https://support.google.com/cloud/answer/13461325?hl=en), [sensitive-scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification).

No Google settings were changed before action-time approval. Preserve unrelated clients, domains and Gmail permissions in the shared project; do not remove them as a shortcut. The intended Vidrial branding URLs are `https://vidrial.vercel.app/`, `/privacy` and `/terms`.

## Implemented code and assets

- The root previously advertised both the correct SVG and the unchanged ICO from the initial template commit. Replace the fallback ICO, regenerate SVG geometry from the shared LogoMark, and add PNG/Apple touch formats.
- Versioned icon URLs explicitly replace browser-cached template selections. Conventional `/favicon.ico` and `/favicon.svg` now also contain Vidrial's mark.
- A repeatable icon compiler and regression tests verify canonical geometry, ICO frame contents and every declared asset. No designer checkerboard PNGs are embedded.
- OAuth callback guidance now distinguishes Google's testing/verification restrictions, declined consent and organisation policy, without echoing arbitrary provider details.

## Verification / release

Generated 180 px PNG visually inspected against the shared mark. Typecheck and production build passed; lint has no errors and seven existing Fast Refresh warnings. App tests: 334 passed, six skipped. Browser tests: all 12 passed, including versioned icon delivery and Apple touch metadata. Development instrumentation emitted source-line attribute hydration warnings during the local run; no test failure resulted.

The icon dependency installation also reconciled the pre-existing stale root Bun lockfile with package.json (existing fonts, blog dependencies, motion and Zod declarations). No new runtime integration or paid dependency was introduced.

Google publishing/verification remains a separately reported external action; never infer approval from a successful web build. The cloud form is left open pending the requested action-time approval.

## Approved cloud changes and production release — 2026-09-06

- Following the user's explicit approval, saved the Vidrial homepage, privacy and terms URLs in the existing Google Auth Platform project. Google displayed `Branding changes saved!`.
- Added the explicitly approved additional test account. After saving and reopening Audience, Google reports two test users, the incomplete-branding warning is absent, and `Publish app` is enabled.
- The OAuth app remains External/Testing. No production publication, verification submission, credential creation, scope change, or removal of unrelated domains/clients was performed. Public publishing affects the shared project's other clients and must be reviewed separately. A saved tester is not evidence that the full channel-connection flow succeeded.
- PR #16 merged normally to main at `55a993e0bef8c470b089ddae798c4bcaeb8714ec`. Vercel production deployment `dpl_FVfBs8fayTXSKkByXo8jkrnmgbN7` reports READY and owns `vidrial.vercel.app`.
- Production `/favicon.ico`, versioned ICO, and Apple touch PNG return HTTP 200 and match the committed SHA-256 bytes. The versioned SVG matches after normalizing the checkout's CRLF trailing newline. Homepage, privacy and terms return HTTP 200 and advertise the versioned icons.
- The new deployment's one-hour error-level runtime scan returned no entries. This is a limited post-deployment observation, not a guarantee for untested authenticated workflows.
- Live channel-connection verification remains blocked by Chrome reporting another extension UI open on the Vidrial page. Do not bypass the browser control restriction. Full production clipping verification also remains outstanding.
