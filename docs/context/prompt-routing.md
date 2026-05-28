# Prompt Routing

Use this guide to select **minimum-sufficient** context packs. Start with `index.pack.md`, then add only packs that materially affect the requested work.

## Baseline

- Always include `docs/context/packs/index.pack.md`.
- Read `docs/README.md` before assembling task context.
- Packs are routing aids and compact summaries; canonical ADRs, architecture docs, and standards win on conflict.

## Pack Selection Table

| If the task materially involves... | Add this pack |
| --- | --- |
| repository layout, package placement, dependency direction | `docs/context/packs/repository-overview.pack.md` |
| cross-layer architecture or boundary decisions | `docs/context/packs/architecture.pack.md` |
| Asset Kernel vocabulary, Asset Registry/Library, system packs, resource-backed asset views | `docs/context/packs/asset-kernel.pack.md` |
| user library, promote/link/copy/import reuse, cross-workspace provenance/propagation | `docs/context/packs/user-library.pack.md` |
| custom asset creation, authored drafts, revisions, overrides, promotion readiness | `docs/context/packs/asset-authoring.pack.md` |
| effective/materialized projections, projection readiness, blockers, diagnostics | `docs/context/packs/effective-asset-projections.pack.md` |
| asset composition plans, compatibility, dependencies, planning blockers | `docs/context/packs/asset-composition-planning.pack.md` |
| runtime readiness, capability matching, runtime resources, execution handoff readiness | `docs/context/packs/runtime-readiness-binding.pack.md` |
| execution plans, dry-run/preflight, planned steps/inputs/outputs, safety gates | `docs/context/packs/execution-plan-preparation.pack.md` |
| conversational runnable systems, sessions, turns, runs, text-generation adapters | `docs/context/packs/controlled-conversational-system-execution.pack.md` |
| runtime adapters, runtime contracts, runtime execution flow | `docs/context/packs/runtime.pack.md` |
| runtime task registry lifecycle, progress, cancellation, retention | `docs/context/packs/runtime-task-registry.pack.md` |
| runtime installers, auto-install, install state, ComfyUI/Git installs | `docs/context/packs/runtime-installer.pack.md` |
| image generation, ComfyUI sidecar, image assets/generated outputs | `docs/context/packs/image-generation.pack.md` |
| Electron host lifecycle, IPC/preload boundaries, desktop composition | `docs/context/packs/desktop-host.pack.md` |
| Electron IPC contracts, operation-derived channels, preload invoke boundaries | `docs/context/packs/ipc-electron.pack.md` |
| renderer feature/page/component work, renderer clients, UI state | `docs/context/packs/desktop-implementation.pack.md` |
| renderer CSS/style architecture, shared style layers, tokens | `docs/context/packs/desktop-styling.pack.md` |
| server lifecycle, Express APIs, thin-client coupling, API route handlers | `docs/context/packs/server-host.pack.md` |
| persistence/storage, artifacts/uploads, storage keys, AppData/server roots, model/artifact storage | `docs/context/packs/persistence-storage.pack.md` |
| authn/authz, route policy, HTTPS/TLS, tokens, credentials, audit, sanitization | `docs/context/packs/security.pack.md` |
| structured logging, diagnostic events, verbosity, safe failure reporting | `docs/context/packs/logging.pack.md` |
| documentation governance, canonical-vs-context updates | `docs/context/packs/docs-standards.pack.md` |
| test strategy, regression coverage, test placement | `docs/context/packs/testing.pack.md` |
| debugging, failures, stack traces, hangs, timeouts, broken UI/API/runtime behavior | `docs/context/packs/debugging-error-handling.pack.md` |

## Common Pack Chains

- Debugging: `index` + `debugging-error-handling`, then add affected host/runtime/storage/UI/feature packs.
- Image generation defects: add `image-generation`, `runtime`, `runtime-task-registry`, `runtime-installer`, `persistence-storage`, `server-host` or `desktop-host` as applicable.
- Asset Library or Asset Registry UI/API/IPC work: add `asset-kernel`, `security`, `testing`, and the affected host/client packs.
- Workspace-scoped assets/resources: add `asset-kernel`, `persistence-storage`, `security`, `testing`, and affected host/client packs.
- User-library reuse: add `user-library`, `asset-kernel`, `persistence-storage`, `security`, `testing`.
- Asset authoring/customization: add `asset-authoring`, `asset-kernel`, `user-library` if source reuse matters, plus `security` and `testing`.
- Projection/composition/readiness/execution handoff: add packs in order from `effective-asset-projections` -> `asset-composition-planning` -> `runtime-readiness-binding` -> `execution-plan-preparation`.
- Controlled conversational execution: add `controlled-conversational-system-execution` plus execution/readiness/composition packs only when those layers are in scope.
- Security changes: add `security` plus the host/client/feature packs whose public boundary changes.
- Desktop renderer styling: add `desktop-implementation` + `desktop-styling`.

## Canonical Escalation Rules

Read and update canonical docs when the task:

- changes architecture, repository structure, standards, or documented behavior,
- changes dependency direction, host/transport/runtime responsibility, persistence/storage responsibility, security policy, or workspace scope,
- changes Asset Kernel semantics, pack/source semantics, mutation behavior, resolver behavior, or public transport/UI exposure,
- exposes a context-pack summary that is incomplete, stale, or ambiguous.

## Boundary Split Rules

- Do not combine API/server-host, IPC/preload/desktop-host, and desktop/thin-client parity implementation into one prompt unless the user explicitly asks for a cross-boundary implementation.
- Do not add host/API/IPC/UI exposure while working on contracts/application services unless the prompt explicitly includes that surface.
- Do not include runtime/provider/storage packs for read-only UI tasks unless those boundaries are directly touched.
- Do not include all phase packs for asset work; include the narrow chain that matches the task.

## Stop Condition

- If required canonical guidance is missing, unclear, or conflicting, update or request clarification for the canonical docs rather than inventing policy silently.
