# Mobile Turnstile Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make signup security verification recover reliably on mobile and validate every supported production hostname explicitly.

**Architecture:** Keep Cloudflare Turnstile mandatory when configured, but move client/server errors into typed classifiers. The browser invalidates stale tokens and performs one bounded automatic widget reset; the server validates actions and hostnames against a static environment allowlist and exposes safe recovery messages.

**Tech Stack:** React 19, TanStack Start server functions, Zod 4, Vitest, Cloudflare Turnstile.

## Global Constraints

- Turnstile secrets remain server-only and tokens are never logged.
- `TURNSTILE_ALLOWED_HOSTNAMES` is a comma-separated server environment value.
- `PUBLIC_APP_URL` is always included in the allowlist.
- Verification is never bypassed when only one of the site key or secret is configured.
- Automated browser verification must not solve the CAPTCHA.

---

### Task 1: Server result classification and hostname allowlist

**Files:**
- Modify: `src/config/env.server.ts`
- Modify: `src/services/security/turnstile.server.ts`
- Modify: `src/services/security/turnstile.server.test.ts`

**Interfaces:**
- Produces: `getTurnstileAllowedHostnames(publicAppUrl: string, configured?: string): Set<string>`
- Produces: `TurnstileVerificationError` with `code` and safe `message`
- Produces: `validateTurnstileResult(value, expectedAction, allowedHostnames)`

- [ ] **Step 1: Write failing tests for aliases and Cloudflare errors**

```ts
expect(getTurnstileAllowedHostnames("https://vidrial.vercel.app", "vid-story-prompt.vercel.app"))
  .toEqual(new Set(["vidrial.vercel.app", "vid-story-prompt.vercel.app"]));
expect(() => validateTurnstileResult({ success: false, "error-codes": ["timeout-or-duplicate"] }, "signup", allowed))
  .toThrowError(expect.objectContaining({ code: "timeout-or-duplicate" }));
expect(validateTurnstileResult({ success: true, action: "signup", hostname: "vid-story-prompt.vercel.app" }, "signup", allowed).success)
  .toBe(true);
```

- [ ] **Step 2: Run the focused server tests**

Run: `npm test -- src/services/security/turnstile.server.test.ts`
Expected: FAIL because the allowlist helper and typed error do not exist.

- [ ] **Step 3: Implement the schema, typed error, and explicit allowlist**

```ts
const turnstileResponseSchema = z.object({
  action: z.string().optional(),
  hostname: z.string().optional(),
  success: z.boolean(),
  "error-codes": z.array(z.string()).optional().default([]),
});

export class TurnstileVerificationError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "TurnstileVerificationError";
  }
}

export function getTurnstileAllowedHostnames(publicAppUrl: string, configured = "") {
  return new Set([
    new URL(publicAppUrl).hostname.toLowerCase(),
    ...configured.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean),
  ]);
}
```

Use the allowlist in `verifyTurnstile`; map `timeout-or-duplicate`, `invalid-input-response`, domain, network, and internal response failures to safe messages.

- [ ] **Step 4: Run the focused tests**

Run: `npm test -- src/services/security/turnstile.server.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/config/env.server.ts src/services/security/turnstile.server.ts src/services/security/turnstile.server.test.ts
git commit -m "fix: harden turnstile verification"
```

### Task 2: Recoverable mobile widget

**Files:**
- Create: `src/components/security/turnstile.test.tsx`
- Modify: `src/components/security/turnstile.tsx`

**Interfaces:**
- Produces: `classifyTurnstileClientError(code?: string): { message: string; retryable: boolean }`
- Extends: `TurnstileApi.reset(widgetId: string): void`

- [ ] **Step 1: Write failing component tests**

```tsx
expect(classifyTurnstileClientError("110200")).toEqual({
  message: "Security verification is not enabled for this website.",
  retryable: false,
});
expect(classifyTurnstileClientError("300030").retryable).toBe(true);
expect(classifyTurnstileClientError("110600").retryable).toBe(true);
```

Render the widget with a fake `window.turnstile`, invoke `error-callback("300030")`, and assert `onToken(null)`, an alert, and exactly one automatic `reset(widgetId)` call.

- [ ] **Step 2: Run the focused client tests**

Run: `npm test -- src/components/security/turnstile.test.tsx`
Expected: FAIL because error codes and reset are unsupported.

- [ ] **Step 3: Implement typed client recovery**

```ts
export function classifyTurnstileClientError(code?: string) {
  if (code === "110200") return { message: "Security verification is not enabled for this website.", retryable: false };
  if (code === "110620") return { message: "Security verification timed out. Try again.", retryable: true };
  if (code?.startsWith("200") || code?.startsWith("300") || code?.startsWith("600") || code === "110600")
    return { message: "Security verification was interrupted. Trying again…", retryable: true };
  return { message: "Security verification could not complete. Please retry.", retryable: true };
}
```

Track one automatic reset per render cycle, always call `onToken(null)` before reset, and retain the manual Retry verification button.

- [ ] **Step 4: Run focused and auth tests**

Run: `npm test -- src/components/security/turnstile.test.tsx src/components/auth/auth-shell.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/security/turnstile.tsx src/components/security/turnstile.test.tsx
git commit -m "fix: recover mobile turnstile challenges"
```

### Task 3: Configuration and verification

**Files:**
- Modify: `docs/DEPLOYMENT.md`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `TURNSTILE_ALLOWED_HOSTNAMES`
- Produces: documented Vercel and Cloudflare hostname checklist

- [ ] **Step 1: Document the exact configuration**

```dotenv
TURNSTILE_ALLOWED_HOSTNAMES=vidrial.vercel.app,vid-story-prompt.vercel.app
```

Document that the same domains must be configured in the Cloudflare widget and that error `110200` indicates a dashboard mismatch.

- [ ] **Step 2: Run security and production checks**

Run: `npm run typecheck && npm run lint && npm test -- src/services/security/turnstile.server.test.ts src/components/security/turnstile.test.tsx && npm run build`
Expected: all commands exit 0.

- [ ] **Step 3: Commit**

```bash
git add .env.example docs/DEPLOYMENT.md
git commit -m "docs: add turnstile hostname configuration"
```

