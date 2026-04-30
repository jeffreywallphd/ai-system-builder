# ADR-0013: Runtime Installer Architecture

## Status
Proposed

## Problem

Runtime sidecars may require local installation before they can be started and used. ComfyUI is the first concrete example in this repository, but it will not be the only runtime target over time.

Future runtime targets may include additional GitHub/Git-installed sidecars, archive/binary-installed sidecars, or package-manager-driven local runtimes.

Installer behavior must not be embedded directly in UI code or feature-specific use cases. Installation must remain behind clean architecture boundaries so runtime targets and installation strategies can evolve without leaking infrastructure concerns into domain/application feature logic.

## Decision

Introduce a generic **Runtime Installer** abstraction.

- Runtime installer responsibilities are separate from runtime supervisor responsibilities.
- Supervisors may call installer operations before startup when configured to do so.
- Installation targets are runtime-specific, but they share common install request/result/status contracts and application ports.

## Layering

- **Contracts** define install target/source/request/result/status semantics.
- **Application port** defines generic install and status operations.
- **Adapters** implement concrete install strategies.
- **Runtime-specific adapters** (for example ComfyUI) compose generic installers with target defaults, without changing shared contracts.

## Runtime Target Model

- Runtime install targets are identified by stable target ids (not UI labels).
- Examples:
  - `comfyui`
  - `python-worker`
  - `future-diffusers`
- Target-specific adapters may provide target defaults (install root conventions, source defaults, safety flags) while preserving generic contracts.

## Source Model

Initial source type:

- `git`

Planned future source types:

- `archive`
- `local-path`
- `package-manager`

Source-specific fields are modeled in contract unions so adapters can evolve source handling without cross-layer coupling.

## Install State

Installer status model:

- `not-installed`
- `installing`
- `installed`
- `update-available`
- `failed`
- `unknown`

## Install Metadata

Installer request/result/status flows may include:

- `installRoot`
- `targetId`
- `source`
- `requestedRef`
- `resolvedRef` / `commitSha` (when available)
- `installedAt`
- `lastCheckedAt`
- `error` and `warnings`

## Safety Rules

- Do not overwrite non-empty unmanaged directories.
- Do not delete user files.
- Installer operations must be idempotent.
- Repair/update behavior must be explicit (opt-in), not implicit.

## Non-Goals (Prompt 1/4)

- No Git clone/fetch/reset implementation.
- No ComfyUI install implementation.
- No UI implementation for install flows.
