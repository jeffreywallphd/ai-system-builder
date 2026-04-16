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
