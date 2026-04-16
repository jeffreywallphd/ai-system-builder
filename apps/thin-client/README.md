# Thin Client App

`apps/thin-client` is the server-backed thin-client host UI surface.

Current scope:

- minimal React bootstrap (`src/main.tsx`, `src/App.tsx`)
- page-first composition (`src/pages/HomePage.tsx`)
- feature-local image upload workflow under `src/features/image-upload/`
- fetch-based HTTP image-upload client that calls the server API route (`/api/image/upload`)
- token-first style baseline under `src/styles/`

The thin-client image-upload path intentionally reuses the server transport + shared application use
case path rather than desktop preload wiring.
