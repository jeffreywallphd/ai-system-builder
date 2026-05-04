# Manual Security Smoke Test

## Shared setup

1. Generate a strong `SERVER_TOKEN_HASH_SECRET` (do not commit or screenshot it):
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   ```powershell
   $bytes = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Fill($bytes); [Convert]::ToHexString($bytes)
   ```
2. Keep secrets out of docs/logs/shell history where possible.

## disabled-dev smoke

1. Start server:
   ```bash
   AI_SYSTEM_BUILDER_SECURITY_MODE=disabled-dev npm run dev:server
   ```
2. Confirm startup log clearly shows disabled/insecure mode.
3. Confirm `/api/security/status` succeeds without auth and reports disabled-dev posture.
4. Confirm model management, image generation, and artifact browser requests work without pairing.

## lan-https-token smoke

1. Generate or provide cert/key (example with mkcert):
   ```bash
   mkcert -install
   mkcert localhost 127.0.0.1 ::1
   ```
2. Start server with HTTPS required:
   ```bash
   AI_SYSTEM_BUILDER_SECURITY_MODE=lan-https-token \
   AI_SYSTEM_BUILDER_TLS_CERT_PATH=/path/to/cert.pem \
   AI_SYSTEM_BUILDER_TLS_KEY_PATH=/path/to/key.pem \
   SERVER_TOKEN_HASH_SECRET=<strong-random-secret> \
   npm run dev:server
   ```
3. Confirm server starts in HTTPS mode and does not fall back to HTTP.
4. Confirm public `GET /api/security/status` works without bearer token.
5. Try protected API before pairing; expect `401` with canonical unauthenticated/invalid-token guidance.
6. Pairing-code provisioning note (current implementation):
   - Pairing completion route exists: `POST /api/security/pairing/complete`.
   - Pairing-code creation/admin UX is not a complete first-implementation workflow.
   - If no provisioning UI/tooling is available in your environment, manual testing requires a pre-existing valid pairing-code entry in the server security store.
7. Complete pairing via valid pairing code and confirm bearer token is not rendered in UI/logs.
8. Confirm authenticated `GET /api/security/status` includes principal semantics when valid bearer token is sent.
9. Confirm protected model/image/artifact API calls succeed when scope permits.
10. Confirm insufficient-scope action returns `403` with canonical `security.forbidden` behavior.
11. Confirm stale/invalid token behavior:
    - invalid token -> `401` + `security.invalid-token`
    - expired token -> `401` + `security.expired-token` (when applicable)
    - revoked token -> `401` + `security.revoked-token` (when applicable)
12. Confirm unknown `/api/*` route is denied by route policy (`security.route-policy-missing`).
13. Confirm startup fails with actionable error if `SERVER_TOKEN_HASH_SECRET` is missing in `lan-https-token`.

## Scope/limitations reminder

- Rate limiting, dedicated audit logging subsystem, and public-internet hardening are not complete in this first implementation.
- mTLS, OAuth, external TLS termination mode, and encryption at rest are future phases.

- Dev enforcement toggle: set `AI_SYSTEM_BUILDER_DEV_SECURITY_TOGGLE_ENABLED=true` with `AI_SYSTEM_BUILDER_SECURITY_MODE=disabled-dev` to test auth-on/auth-off behavior without restarting for every auth test.
- Changing transport listener mode (HTTP/HTTPS) still requires restarting `dev:server`; the dev toggle does not enable TLS transport.
