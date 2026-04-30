# Runtime Installer Context Pack

## When to Include This Pack

Include this pack when prompts involve:

- runtime sidecar installation architecture
- auto-install behavior before runtime startup
- runtime installer contracts/ports/adapters
- ComfyUI install planning as an adapter concern
- Git-based runtime install source modeling

## Installer Architecture

- Runtime installer is a generic abstraction for sidecar installation lifecycle.
- Contracts define install request/result/status semantics.
- Application depends on installer ports, not install strategy details.
- Adapters implement concrete strategies (git first, others later).
- Runtime-specific adapter composition can apply target defaults while preserving generic contracts.

## Runtime Installer vs Runtime Supervisor Boundary

- **Runtime installer**: installation/discovery/repair/update status and metadata.
- **Runtime supervisor**: process lifecycle (start/stop/restart/health) after runtime is install-ready.
- Supervisor may call installer before startup when configured, but installer remains a separate concern.

## ComfyUI Positioning

- ComfyUI is the first runtime installer target adapter.
- ComfyUI is **not** the installer abstraction itself.
- Generic contracts and ports must not hardcode ComfyUI-specific behavior.

## Guardrails

- Do not install directly from UI components.
- Do not embed installer logic in feature use cases beyond port orchestration.
- Do not hardcode ComfyUI-specific logic into generic installer contracts/ports.
- Keep installation strategy details in adapter layer.

## Canonical References

- `docs/adr/ADR-0013-runtime-installer.md`
- `docs/adr/ADR-0012-image-generation-runtime.md`
