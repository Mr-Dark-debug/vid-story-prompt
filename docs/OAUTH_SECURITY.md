# Connector OAuth security

## Implemented controls

- Google Drive, Dropbox, and OneDrive use official OAuth 2.0 endpoints and least-privilege read scopes.
- Every authorization starts on an authenticated server route and is bound to the current user, workspace, connector, expiry, and safe in-app return path.
- A fresh PKCE verifier and SHA-256 challenge are generated for every attempt.
- OAuth state contains a random nonce plus an HMAC signature. The server stores only its hash, an encrypted verifier, and transaction context.
- Callback URLs are exact per connector: `/auth/connectors/:connectorId/callback`.
- State is time-limited, single-use, signature checked with constant-time comparison, and consumed before tokens are persisted.
- Provider identity is resolved through the provider's official identity endpoint before the connection becomes active.
- Access and refresh tokens are encrypted at rest with a server-only key. Tokens, code verifiers, authorization codes, and provider secrets are never returned by catalog or browse handlers.
- Refresh happens server-side. Qualifying refresh failure changes connection health to `reconnect_required`.
- Disconnect clears local encrypted tokens immediately. Google and Dropbox revocation is also attempted at the provider; OneDrive local revocation prevents further Vidrial use and the user may revoke the app from Microsoft account controls.

## Configuration

Set `CONNECTOR_TOKEN_ENCRYPTION_KEY` to a high-entropy value of at least 32 characters on both the web server and worker. Configure only the providers being enabled:

- Google Drive: `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`
- Dropbox: `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`
- OneDrive: `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID`

Provider consoles must register the exact HTTPS production callback URL. Development callback URLs must be registered separately. Rotating the encryption key requires a planned token re-encryption or reconnect campaign; silently changing it invalidates existing connections.

## Database boundary

`oauth_connections` is server/worker only. `connector_connections` omits encrypted token columns and is the only intended summary shape. Service handlers additionally scope every query by the authenticated workspace and user. PostgreSQL triggers enforce connection limits even when a service-role callback writes the row.

## Operational verification still required

Automated tests cover state tampering, encryption boundaries, provider response validation, refresh/revocation code paths, and absence of token fields in browser components. A release operator must still complete a real OAuth connect, browse, refresh, disconnect, and provider-side revocation test for each configured provider. Until that evidence exists, these connectors remain labelled Beta.
