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
