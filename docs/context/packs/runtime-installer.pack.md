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

## Metadata and Safety

- Runtime installers should write install metadata under the install root or a target-specific metadata file.
- Metadata should include source, requested ref, resolved ref/commit SHA, installedAt, lastCheckedAt, and an ownership/managed marker.
- The managed marker is required before repair/update modifies an existing non-empty directory.
- Prompt 2 can choose the exact metadata filename; suggested: `.ai-system-builder-runtime-install.json`.

## Prompt 2 Progress

- A generic Git runtime installer adapter exists in the adapter layer.
- The Git installer is generic and not ComfyUI-specific.
- The installer writes managed install metadata (`.ai-system-builder-runtime-install.json` by default).
- The installer refuses to mutate non-empty unmanaged install directories.
- The installer never performs destructive cleanup/repair for unmanaged non-empty directories.
- `forceRepair` is conservative: it reuses managed update/repair flow only and does not permit destructive unmanaged repair.
- Managed metadata must be valid before an install root is considered managed.
- Update semantics are conservative: fetch always runs, pinned refs/tags/SHAs are checked out and recorded, and pull is only used when no ref is pinned.
- ComfyUI-specific defaults/composition are deferred to Prompt 3.

## ComfyUI Installer Composition

- ComfyUI installer is a thin adapter that composes the generic Git runtime installer.
- Python dependency installation is best-effort and non-destructive.
- Virtual environment management is not implemented yet.
- GPU/Torch installation is not implemented yet.
