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

## Renderer Upload Component

`src/renderer/App.tsx` provides a plain single-image upload form:

- selects one file from a native file input (`accept="image/*"`)
- reads file bytes in the renderer (`File.arrayBuffer()` -> `Uint8Array`)
- calls only `window.desktopApi.uploadImage(...)`
- renders basic success/error feedback from structured IPC response data

Renderer constraints for this slice:

- no direct filesystem access from UI
- no direct IPC channel usage from UI
- no styling expansion beyond the existing minimal renderer structure
