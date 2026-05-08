# Context Pack: Index (Baseline)

- Pack name: `index`

## Purpose

- Provide the always-included baseline context for all automation and implementation prompts.
- Establish repository-wide guardrails while keeping context payloads minimal.

## Use When

- Every automated prompt and implementation task in this repository.
- Any task that needs baseline standards before adding specialized packs.

## Do Not Use When

- Never omit for repository work.
- Do not treat this as a replacement for canonical docs when a task needs deeper detail.

## Core Guidance

- Respect architectural boundaries: keep domain/application free of host, transport, UI, and infrastructure leakage.
- Prefer minimum-sufficient context: include only additional packs required for the current task.
- Avoid speculative abstraction, package proliferation, and folder/package duplication without concrete need.
- Use role-revealing names; avoid vague catch-all naming for files, folders, and symbols.
- Use shared operation identity helpers/patterns for contract operations (lowercase dotted names) to prevent ad hoc drift.
- Treat API and IPC contracts as specializations of shared transport contracts, not parallel response/error systems.
- Use best practices in code commenting in all code files.
- Keep IPC channels operation-derived (`ipc.<operation>.<kind>`) via shared helpers.
- Update canonical docs in the same change when documented behavior/architecture/standards change.
- Use structured, meaningful logs with configurable verbosity and stage-level timing for long operations.
- Keep runtime diagnostics as a strict specialization of shared structured logging contracts (`runtime.*` events, mechanical mapping).
- Treat the Asset Kernel as the canonical platform guardrail for assets: assets are versioned, configurable, AI-readable, machine-composable semantic units for features, systems, subsystems, and systems composed of subsystems; Prompt 6 added descriptor-only machine-readable port, binding constraint, dependency, composition rule/cardinality, and composition validation summary contracts, the pre-Prompt 7 cleanup tightened JSON-safe metadata/details, first-class declarative requirements, safe semantic references, and shared validation summary statuses to the existing `modules/contracts/asset` family after Prompt 4 configuration and Prompt 5 AI-context contracts, Prompt 7 adds pure deterministic application validation services under `modules/application/services/asset`, and Prompt 8 adds application repository port interfaces under `modules/application/ports/asset` plus transport/UI-neutral use cases under `modules/application/use-cases/asset`, with the pre-Prompt 9 cleanup making `asset-binding` references and binding repository seams explicit and Prompt 9 adding minimal local JSON persistence adapters for definitions, instances, compositions, and bindings with value-based text filters, current manifest schema/kind checks, and JSON-compatible writes only, and Prompt 10 adding resource-backed asset mapping contracts plus pure application helpers for artifact/image/dataset/model/storage/repository/generated-output/preview backings with safe `asset-resource-backing` links and provider paths kept as metadata without durable registration, and Phase 2B Prompt 2 adding the shared internal `composeLocalAssetKernel` helper for local Asset Kernel repositories/use cases from a storage root under `<storageRoot>/asset-kernel/` as the local persistence base before final Phase 2B desktop/server internal host composition and adding no API/IPC/UI/seeding/resource-scan exposure, Phase 2B Prompt 3 adding an application-owned built-in asset definition seeding service that validates through Asset Kernel seams, saves missing valid definitions, is idempotent by seed ID + seed version + built-in fingerprint metadata, skips user/custom or seed-version/fingerprint conflicts without overwrite, with seed-version conflicts reported as `skipped-seed-version-mismatch`, and Phase 2B Prompt 4 adding the initial application-owned built-in catalog with stable `builtin.*` IDs, explicit `1.0.0` versions, concise AI context/configuration/ports, shared runtime-capability requirements, resource-backed descriptors including `builtin.artifact` as a generic `data-source` distinct from document-specific `builtin.document`, and Phase 2B Prompt 5 adding computed internal resource-backed read views for existing artifacts/images/datasets/models/documents/repository objects/generated outputs/previews without persistence, source-family refactors, UI/API/IPC/preload/thin-client/host exposure, runtime/filesystem/network/AI behavior, or treating generated outputs/external repository objects/previews as registered assets before explicit finalization/import/registration, and Phase 2B Prompt 6 adding a read-only transport/UI-neutral application Asset Registry read facade that forwards repository-supported filters before deterministic diagnostic facade-side filtering, aggregates repository reads, optional injected computed resource-backed views, exact version-aware built-in markers/catalog matches, and explicit opt-in validation without seeding, storage scans, host wiring, API/IPC/UI exposure, runtime readiness/task-registry calls, or save/update/delete behavior, and Phase 2B Prompt 7 adding shared host-level internal `composeInternalAssetRegistry` wiring for local Asset Kernel persistence/use cases plus that read facade, with optional injected resource-backed provider seam, path-safe diagnostics that omit seed catalog counts, no automatic seeding, and no public transport/UI exposure, and the final Phase 2B cleanup composing that internal registry during desktop/server host registration under `<storageRootDirectory>/asset-kernel/` with runtime roots excluded, host-internal getters only, explicit built-in seeding, no resource scans/bytes/provider calls unless a safe injected provider is supplied, and no API/IPC/preload/renderer/thin-client exposure, stabilizing this internal-only state for Phase 2C read-only transport wrappers and Asset Library UI work that must consume those wrappers rather than local persistence/host helpers; do not invent parallel models for artifacts/resources/UI/workflows/tools/generated outputs/previews/AI context.
- Keep runtime readiness as transport-neutral shared vocabulary for host-owned capability availability; application readiness mapping reads host-composed, host-scoped provider signals but must not own task registry lifecycle, installer operations, supervisor process lifecycle, or UI/API/IPC payload design. Desktop IPC and server API transports wrap shared readiness contracts for host-scoped reads without redefining readiness shapes. Runtime task not-found status must remain an honest explicit `recordType: "not-found"` contract rather than a fake `TaskType`.
- Phase 2C desktop Asset Registry IPC/preload exposure is definitions-only and read-only. It wraps the application read facade/read port and must not expose mutation, seeding, import/finalize/register, resource scanning, runtime/provider execution, direct persistence access, renderer UI pages, or thin-client UI pages.
- Phase 2C Asset Library UI-client work is definitions-only and read-only: shared UI read models/mappers live under `modules/ui/shared/asset-library`, desktop renderer clients call preload read methods, and thin-client clients call GET-only server API routes. Phase 2C Prompt 5 adds the desktop top-level `Assets` page using that read-only client with advanced details collapsed by default; Phase 2C Prompt 6 adds the separate thin-client `/assets` page using the read-only server API client with advanced details collapsed by default. Mutations, seeding, import/finalize/register, scans, runtime/provider execution, byte reads, and direct application/host/persistence/route-handler/desktop IPC imports remain forbidden.
- Keep persistence and storage contract families mechanically distinct (record-aligned operations vs key-based artifact operations).
- Use ingestion/staged-artifact contracts for inbound-content semantics; treat upload flows as specialized intake paths rather than isolated file-operation worlds.
- Import contracts via family barrels (`modules/contracts/<family>`); avoid deep internal contract imports and flattened catch-all usage.
- For non-contract modules, avoid root `modules/contracts` imports; consume contracts from specific family barrels.
- Keep contract anti-drift tests explicit: family invariants in `modules/contracts/<family>/tests` and cross-family invariants in `modules/contracts/tests`.
- Keep application orchestration on explicit port seams in `modules/application/ports/**`; do not bypass ports by coupling application code directly to adapters.
- Keep application ports thin and role-revealing, with family seam tests in `modules/application/ports/<family>/tests` and minimal cross-family seam checks in `modules/application/ports/tests`.
- Add regression tests for meaningful bug fixes when practical; prioritize behavioral value and deterministic tests.

## Key Constraints

- This pack is a routing baseline, not a second source of truth.
- Canonical rules remain in ADR, architecture, and standards docs.
- This pack is never sufficient by itself for architecture-, standards-, structure-, or boundary-changing work.
- If pack summaries conflict with ADRs/architecture/standards docs, canonical docs win.
- Prompt builders must add only targeted companion packs (not all packs by default).

## Canonical Source Docs

Only use these when needed. Do not overload the context window with uncessary information.

- `docs/adr/README.md` — ADR workflow and decision-record discipline.
- `docs/architecture/module-dependency-rules.md` — boundary and dependency direction constraints.
- `docs/architecture/system-overview.md` — repository shape and packaging restraint posture.
- `docs/architecture/asset-kernel.md` — canonical Asset Kernel terminology, boundaries, and Phase 2A sequence.
- `docs/standards/coding-standards.md` — implementation discipline and abstraction restraint.
- `docs/standards/naming-standards.md` — role-revealing naming requirements.
- `docs/standards/documentation-standards.md` — canonical documentation responsibilities and update rules.
- `docs/standards/logging-standards.md` — structured logging, verbosity, and diagnostics expectations.
- `docs/standards/testing-standards.md` — behavior-focused testing expectations and regression policy.

## Common Over-Inclusions to Avoid

- Loading every architecture/standards doc for routine, narrow tasks.
- Including host-specific packs for non-host work.
- Copying full canonical docs into prompt payloads.

## Prompt Assembly Notes

- Always include this pack first.
- Add only the smallest set of specialized packs required by the task.
- When a task affects canonical rules or boundaries, read and update the relevant canonical docs directly.
- Typical order: `index` → task-specific pack(s) → targeted canonical doc links when needed.
- For desktop renderer/main/preload implementation work, pair `desktop-host` with `desktop-implementation` instead of broad unrelated packs.
- For debugging/error-fix prompts, pair this baseline with `debugging-error-handling` first, then add boundary-specific packs (`runtime`, `desktop-host`, `server-host`, `desktop-implementation`) as needed.
- For desktop renderer styling tasks, pair `desktop-implementation` with `desktop-styling` and include only style-relevant canonical docs.

- Treat runtime instances as host-owned: shared contracts/use cases define behavior, while host composition selects local or future remote execution placement; see ADR-0013 for cross-host runtime ownership.
- Security is layered and adapter-based; use ADR-0015 and `security.pack.md` for authn/authz, transport encryption, storage security, credential handling, audit, and runtime security work.

## Server readiness API baseline

- Server API runtime readiness wraps shared host-scoped readiness contracts via the application readiness service; it remains separate from desktop IPC readiness and from feature-specific runtime execution endpoints.
