# Context Pack: System Builder

- Pack name: `system-builder`

## Purpose

- Keep composed-system work aligned to the Asset Kernel and the Systems product area.
- Prevent builder-application status from being modeled as user system state.

## Use When

- Changing System Builder records, system composition semantics, or the Systems page.
- Preparing system creation, editing, validation, persistence, or plan materialization.
- Preparing deterministic builds, immutable releases, composed policy, finite workflows, or system-level Run & Test.
- Moving or labeling software status and runtime diagnostics near the Systems/Settings boundary.

## Do Not Use When

- A task concerns only System Foundation ownership, a system prompt, or operating-system resources.
- Runtime diagnostics work does not affect System Builder terminology or placement.

## Core Guidance

- A system is a workspace-owned composed Asset Kernel unit, not builder-application health.
- Reuse `AssetComposition`, asset instances, bindings, references, rules, provenance, and validation summaries.
- System compositions are limited to `system` and `system-of-subsystems`.
- System Builder lifecycle is design-time only; never substitute runtime, installer, host, or software-health status.
- Keep asset composition planning as an optional non-executing source record.
- Require explicit workspace identity for every future system-owned operation and persistence seam.
- Systems is workspace-scoped; Settings / Software status remains global and operational.
- Design identity, immutable revisions, build attempts, immutable releases, deployments, and execution runs are separate record families.
- Security assets may narrow but never widen platform/organization authority; the initial workflow language is finite, typed, and capability-based.

## Current Implementation Shape

- Contracts and immutable revisions: `modules/contracts/system-builder/`.
- Repository port and application behavior:
  `modules/application/ports/system-builder/` and
  `modules/application/use-cases/system-builder/`.
- Shared structured persistence: `modules/adapters/persistence/system-builder/`.
- Shared system validation:
  `modules/application/services/system-builder/validate-system-builder-revision.service.ts`.
- API/IPC transports and clients are present for both hosts; Systems uses the
  shared `modules/ui/shared/system-builder/` editor in desktop and thin client.
- Deterministic attempts and immutable releases live in the separate
  `system-build` contract, application, persistence, storage, API/IPC, and
  shared Build & Release workflow families. Approval re-verifies every artifact
  and derives release identity from content.
- Plans and whole-system Run & Test live under Systems, not Assets.
- The closed secured data-entry template and its release-bound `system-data`
  runtime are implemented. Runtime schema/policy comes only from one verified
  approved manifest; application services own validation, authorization,
  masking, optimistic writes, and redacted audit. Desktop and thin-client use
  the shared `SystemDataRunTest` presenter.
- The closed controlled-chatbot template composes reusable foundation and
  conversation assets, builds through the existing immutable release pipeline,
  and uses the shared `ConversationRunTest` presenter with real execution-plan
  identity. Protected instructions stay behind application boundaries; release
  approval is not runtime activation.
- Operational diagnostics remain in
  `apps/desktop/src/renderer/features/settings/components/SoftwareStatusSection.tsx`.
- Deployment activation and approved-release execution are not implied by the
  design-time editor or a successful build; those remain later increment
  boundaries.

## Canonical Source Docs

- `docs/architecture/system-builder.md`
- `docs/architecture/system-build-and-release.md`
- `docs/adr/ADR-0024-system-builder-area-and-software-status-placement.md`
- `docs/adr/ADR-0033-system-builds-releases-security-and-workflows.md`
- `docs/architecture/asset-kernel.md`
- `docs/architecture/asset-composition-planning.md`
- `docs/architecture/workspace-model.md`
- `docs/architecture/module-dependency-rules.md`

## Anti-Drift Rules

- Do not create a parallel asset/composition vocabulary in System Builder.
- Do not put Python, ComfyUI, host lifecycle, resource utilization, or software status on System Builder records.
- Do not make Systems globally accessible without an active workspace.
- Do not claim deployment, execution, independent reproducibility, or a higher
  SLSA assurance level until its implementation and qualifying evidence exist.
- Do not mutate old system revisions/releases or store deployment/runtime status in design records.
- Do not rename valid ownership terms such as `system.foundation` or `system-owned`.

## Companion Packs

- `asset-kernel` for component and composition vocabulary.
- `asset-composition-planning` for plan inputs and compatibility.
- `desktop-implementation` for Systems or Settings UI changes.
- `persistence-storage`, `ipc-electron`, `server-host`, or `testing` only when those boundaries are explicitly in scope.
