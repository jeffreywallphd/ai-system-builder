# Thin Client App

`apps/thin-client` is the server-backed thin-client host UI surface.

Current scope:

- minimal React bootstrap (`src/main.tsx`, `src/App.tsx`)
- page-first composition (`src/pages/HomePage.tsx`)
- feature-local artifact upload workflow under `src/features/artifact-upload/`
- feature-local artifact browser workflow under `src/features/artifact-browser/`
- fetch-based HTTP artifact-upload client that calls the server API route (`/api/artifact/upload`)
- artifact publish flow that calls `POST /api/artifact/publish` and surfaces published backing details
- artifact publish verification/re-check flow that calls `POST /api/artifact/publish/verify`
- imported-source verification/re-check flow that calls `POST /api/artifact/source/verify`
- artifact detail panel can render persisted published backing metadata from server-side binding records
- artifact register/import flow that calls `POST /api/artifact/register-from-repo` and refreshes artifact-browser selection on success
- imported artifact localize/download flow that calls `POST /api/artifact/localize-from-repo` when remote-source artifacts do not yet have local bytes
- artifact browser list/detail now surfaces minimal artifact-first backing-state cues (`Remote only`, `Localized`, `Published`) and local object availability/localization state
- artifact-browser publish/re-check state orchestration now uses a shared cross-host hook from `modules/ui/shared`
- token-first style baseline under `src/styles/`

## Hugging Face auth behavior

- Thin-client Hugging Face register/localize/publish/verify requests are server-backed.
- Configure `HF_TOKEN` or `HUGGING_FACE_TOKEN` (or server host `huggingFaceAccessToken`) in the **server** environment for private/gated Hugging Face repositories.
- Public repositories may work without a token depending on repository visibility/provider policy.
- Missing/invalid token and access-denied responses are surfaced as explicit auth-required/access-denied errors in UI messaging.

The thin-client artifact-upload path intentionally reuses the server transport + shared application use
case path rather than desktop preload wiring.

## Development wiring

- Default API base URL in thin-client code is `/api`.
- In local development, Vite proxies `/api` to the server on `127.0.0.1:3010`, which allows running
  thin-client and server on separate ports while keeping feature clients same-origin by default.
- Thin-client Vite dev server defaults to HTTP at `http://localhost:5173`.
- Optional thin-client Vite HTTPS can be enabled with:
  - `AI_SYSTEM_BUILDER_THIN_CLIENT_HTTPS_ENABLED=true`
  - explicit cert/key files via `AI_SYSTEM_BUILDER_THIN_CLIENT_TLS_CERT_PATH` and
    `AI_SYSTEM_BUILDER_THIN_CLIENT_TLS_KEY_PATH`, or
  - generated/reused dev cert material via `AI_SYSTEM_BUILDER_TLS_CERT_MODE=auto-self-signed`
    or `auto-local-ca`.
- When explicit thin-client cert/key paths are set, files must be present and readable or Vite startup fails with an actionable error.
- Thin-client HTTPS env vars control only the Vite UI listener (port 5173), not server API listener mode (port 3010).
- When `AI_SYSTEM_BUILDER_HTTPS_ENABLED=true` or `AI_SYSTEM_BUILDER_SECURITY_MODE=lan-https-token` is
  set for the thin-client dev server process, the Vite proxy targets `https://127.0.0.1:3010`.
- For dev-generated TLS (`AI_SYSTEM_BUILDER_TLS_CERT_MODE=auto-self-signed` or `auto-local-ca`), the
  Vite proxy disables proxy-side certificate verification so Node can reach the HTTPS dev server.
- To force a specific dev proxy origin, set `AI_SYSTEM_BUILDER_THIN_CLIENT_API_PROXY_TARGET`.
- To use a different server origin directly, set `VITE_API_BASE_URL` (for example
  `http://127.0.0.1:3100/api`).

## Upload transport

- Thin-client artifact upload submits browser-native `multipart/form-data`.
- The upload form payload uses:
  - `file`: binary file body
  - `source`: upload source identifier

## Commands

From the repository root:

- `npm run dev:thin-client`
- `npm run build:thin-client`
- `npm run preview:thin-client`

From this workspace directly:

- `npm run dev`
- `npm run build`
- `npm run preview`


## Hugging Face token configuration UI

- Artifact Browser now includes a **Hugging Face token** section that shows configured/not-configured status and masked token state.
- Use **Save token** to configure/update token and **Clear token** to remove it.
- Token source of truth is server-side config (`/api/config/huggingface-token`), not browser-local state.
- Auth-required artifact errors now direct users to this in-product token settings path.


## Thin-client Vite HTTPS development examples

### Default HTTP thin-client

```bash
npm run dev:thin-client
```

UI origin: `http://localhost:5173`

### HTTPS server API, HTTP thin-client

```bash
AI_SYSTEM_BUILDER_HTTPS_ENABLED=true \
AI_SYSTEM_BUILDER_TLS_CERT_MODE=auto-self-signed \
npm run dev:thin-client
```

- UI remains `http://localhost:5173`.
- `/api` proxy target becomes `https://127.0.0.1:3010`.

### HTTPS server API and HTTPS thin-client

```bash
AI_SYSTEM_BUILDER_THIN_CLIENT_HTTPS_ENABLED=true \
AI_SYSTEM_BUILDER_HTTPS_ENABLED=true \
AI_SYSTEM_BUILDER_TLS_CERT_MODE=auto-self-signed \
npm run dev:thin-client
```

- UI origin becomes `https://localhost:5173`.
- `/api` proxy target is `https://127.0.0.1:3010`.
- Thin-client Vite generates or reuses dev certificate material under `apps/thin-client/.local/security/tls`
  unless `AI_SYSTEM_BUILDER_THIN_CLIENT_TLS_CERT_DIRECTORY` or `AI_SYSTEM_BUILDER_TLS_CERT_DIRECTORY` is set.

To force explicit thin-client cert/key files instead:

```bash
AI_SYSTEM_BUILDER_THIN_CLIENT_HTTPS_ENABLED=true \
AI_SYSTEM_BUILDER_THIN_CLIENT_TLS_CERT_PATH=/path/to/cert.pem \
AI_SYSTEM_BUILDER_THIN_CLIENT_TLS_KEY_PATH=/path/to/key.pem \
AI_SYSTEM_BUILDER_HTTPS_ENABLED=true \
AI_SYSTEM_BUILDER_TLS_CERT_MODE=auto-self-signed \
npm run dev:thin-client
```

Notes:

- You can reuse server-generated dev cert/key files for thin-client HTTPS when certificate SANs include `localhost`.
- Thin-client does not auto-discover server cert file paths. Set thin-client cert/key env vars explicitly
  when you want the Vite UI listener to use a specific certificate.
- Browser trust warnings may still occur for self-signed certificates.
- `auto-local-ca` requires manual CA trust installation.
- Switching thin-client Vite between HTTP/HTTPS requires restarting `npm run dev:thin-client`.
- Never commit or log private keys; this TLS mode is for development only, not public-internet hardening.
