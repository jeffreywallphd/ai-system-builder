# Thin Client App

`apps/thin-client` is the server-backed thin-client host UI surface.

Current scope:

- minimal React bootstrap (`src/main.tsx`, `src/App.tsx`)
- page-first composition (`src/pages/HomePage.tsx`)
- feature-local image upload workflow under `src/features/image-upload/`
- feature-local artifact browser workflow under `src/features/artifact-browser/`
- fetch-based HTTP image-upload client that calls the server API route (`/api/image/upload`)
- artifact publish flow that calls `POST /api/artifact/publish` and surfaces published backing details
- artifact publish verification/re-check flow that calls `POST /api/artifact/publish/verify`
- artifact detail panel can render persisted published backing metadata from server-side binding records
- artifact register/import flow that calls `POST /api/artifact/register-from-repo` and refreshes artifact-browser selection on success
- imported artifact localize/download flow that calls `POST /api/artifact/localize-from-repo` when remote-source artifacts do not yet have local bytes
- artifact-browser publish/re-check state orchestration now uses a shared cross-host hook from `modules/ui/shared`
- token-first style baseline under `src/styles/`

The thin-client image-upload path intentionally reuses the server transport + shared application use
case path rather than desktop preload wiring.

## Development wiring

- Default API base URL in thin-client code is `/api`.
- In local development, Vite proxies `/api` to `http://127.0.0.1:3000`, which allows running thin-client
  and server on separate ports while keeping feature clients same-origin by default.
- To use a different server origin directly, set `VITE_API_BASE_URL` (for example
  `http://127.0.0.1:3100/api`).

## Upload transport

- Thin-client image upload submits browser-native `multipart/form-data`.
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
