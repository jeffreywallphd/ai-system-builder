# Server App

`apps/server` is the Node/Express server host entry point.

## Toolchain

- Runtime: Node.js + TypeScript
- Transport adapter: Express (`modules/adapters/transport/api-express`)
- Composition root: `modules/hosts/server`
- Build output: `dist/apps/server/src/index.js`

## Commands

From the repository root:

- `npm run dev:server` - start server in watch mode (`tsx watch`) for local development.
- `npm run build:server` - compile server host and shared modules with `tsc`.
- `npm run start:server` - build then run compiled output.

From this workspace directly:

- `npm run dev`
- `npm run build`
- `npm run start`

## Hugging Face token configuration

- Server-host artifact-repo composition reads Hugging Face token from:
  1. `artifactRepo.huggingFaceAccessToken` composition option, then
  2. `HF_TOKEN`, then
  3. `HUGGING_FACE_TOKEN`.
- Thin-client Hugging Face register/localize/publish/verify flows depend on this server-side configuration for private/gated repositories.

## Local runtime state

- `SERVER_STORAGE_ROOT` overrides server artifact storage.
- `SERVER_RUNTIME_ROOT` overrides server-owned runtime state for ComfyUI, Python worker caches, and managed runtime dependencies.
- Without overrides, server runtime state lives under `apps/server/.local/server-runtime`, which keeps dev runtime installs out of the source tree and separate from artifact storage.

## Security modes and HTTPS startup

### `disabled-dev` (insecure local development)

```bash
AI_SYSTEM_BUILDER_SECURITY_MODE=disabled-dev npm run dev:server
```

- HTTP is allowed.
- Authentication is not required for protected APIs.
- Startup logs include a loud insecure warning once at startup.
- Use this only on a trusted local machine; it is not safe for LAN/shared networks.

### `lan-https-token` (LAN pairing + bearer token)

Required environment variables:

```bash
AI_SYSTEM_BUILDER_SECURITY_MODE=lan-https-token
AI_SYSTEM_BUILDER_TLS_CERT_PATH=/path/to/cert.pem
AI_SYSTEM_BUILDER_TLS_KEY_PATH=/path/to/key.pem
AI_SYSTEM_BUILDER_PAIRING_ENABLED=true
SERVER_TOKEN_HASH_SECRET=<strong-random-secret>
```

Optional root overrides often used in local setups:

```bash
SERVER_STORAGE_ROOT=/path/to/server-artifacts
SERVER_RUNTIME_ROOT=/path/to/server-runtime
```

Behavior:

- HTTPS is required and there is no silent fallback to HTTP.
- Certificate/key files must be readable before startup completes.
- Protected APIs require a valid bearer token from LAN pairing.

### Certificate options

- User-supplied certificate/private key PEM files.
- `mkcert`-generated development/LAN certs.
- Private LAN CA-issued certificate/private key.

Not implemented in this phase: automatic ACME/web-CA certificate provisioning, external reverse-proxy TLS termination mode, mTLS, OAuth, or production public-internet hardening.

## Manual mkcert workflow (no runtime dependency)

Example:

```bash
mkcert -install
mkcert localhost 127.0.0.1 ::1 <your-lan-hostname> <your-lan-ip>
```

Then run server with generated files:

```bash
AI_SYSTEM_BUILDER_SECURITY_MODE=lan-https-token \
AI_SYSTEM_BUILDER_TLS_CERT_PATH=./certs/localhost+lan.pem \
AI_SYSTEM_BUILDER_TLS_KEY_PATH=./certs/localhost+lan-key.pem \
SERVER_TOKEN_HASH_SECRET=<strong-random-secret> \
npm run dev:server
```

If you generate certs inside this repo, keep them out of git (for example under an ignored `certs/` directory).


### Dev HTTPS in `disabled-dev` (restart required)

Default `npm run dev:server` starts in `disabled-dev` with HTTP and no auth.

To run HTTPS while staying in `disabled-dev`:

```bash
AI_SYSTEM_BUILDER_SECURITY_MODE=disabled-dev
AI_SYSTEM_BUILDER_HTTPS_ENABLED=true
AI_SYSTEM_BUILDER_TLS_CERT_PATH=/path/to/cert.pem
AI_SYSTEM_BUILDER_TLS_KEY_PATH=/path/to/key.pem
AI_SYSTEM_BUILDER_DEV_SECURITY_TOGGLE_ENABLED=true
npm run dev:server
```

- Listener protocol (HTTP/HTTPS) is selected at startup and requires restart to change.
- Dev security enforcement dropdown only appears when `AI_SYSTEM_BUILDER_DEV_SECURITY_TOGGLE_ENABLED=true`.
- Dev enforcement toggles auth behavior only (`disabled-dev` vs `lan-token-enforced`), not transport mode.

## Token handling and storage

- Pairing tokens are bearer secrets; do not share them.
- Server persists token hashes only in the server security store.
- Thin-client stores the bearer token through `pairedDeviceTokenStore`.
- Current thin-client browser persistence uses localStorage for initial LAN workflow; treat this as a convenience model, not hostile-browser hardened storage.
- Clearing client token forgets local pairing for that device.

## Manual smoke checklist

Detailed checklist: `docs/security/manual-smoke-test.md`.


### `SERVER_TOKEN_HASH_SECRET`

- Used to derive stable token hashes for credential lookup; this value is sensitive.
- In `lan-https-token` mode it is required at startup.
- In `disabled-dev` mode, if unset, the server falls back to an explicitly insecure dev-only default and logs a warning.
- Never commit this value and never log it.

Generate examples:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

```powershell
$bytes = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Fill($bytes); [Convert]::ToHexString($bytes)
```

- Do not put it in docs, logs, screenshots, or shell history where avoidable.
- Prefer a secret manager or user-level environment variable for routine local use.

## Dev security enforcement toggle (development only)

- Startup security mode (`AI_SYSTEM_BUILDER_SECURITY_MODE`) still owns HTTP/HTTPS listener protocol and requires restart to change.
- Optional dev-only toggle: `AI_SYSTEM_BUILDER_DEV_SECURITY_TOGGLE_ENABLED=true` (only active when startup mode is `disabled-dev`).
- This toggle only changes request-time auth enforcement (`disabled-dev` vs `lan-token-enforced`) for local testing.
- It does **not** switch a running listener between HTTP and HTTPS.
- Do not use this toggle as production security.
