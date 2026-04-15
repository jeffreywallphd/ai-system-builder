# Desktop App

## Preload Bridge Surface

The preload layer exposes a narrow desktop API at `window.desktopApi` for UI-to-host transport.

Current method:

- `uploadImage(input, context?)`
  - maps UI-provided upload payload into the `image.upload` IPC request envelope
  - invokes only `ipc.image.upload.request`
  - returns the structured IPC upload response envelope

Design constraints:

- preload remains transport-oriented (no business/use-case logic)
- UI callers do not access IPC primitives or filesystem details directly
