# Prompt Routing Guidance

This guide complements the machine-readable routing artifacts with practical steps for contributors choosing context assets for a task.

## Canonical Routing Sources

Use these files together, in this order:

1. `docs/context/routing/task-to-context-routing.contract.json`
2. `docs/context/routing/task-to-context-routing.seed.json`
3. `docs/context/context-map.json`
4. `docs/context/routing/prompt-routing-contract.md`

Treat machine-readable files as authoritative for category, selection mode, and priority tier values.

## Deterministic Routing Workflow

1. Classify the task into exactly one `taskCategory`.
2. Capture required routing signals: `taskSummary`, `taskCategory`, `requestedOutcomes`, `changedPaths`, `constraints`.
3. Resolve the mapped route from `task-to-context-routing.seed.json`.
4. Apply selection mode, assembly profile ordering, and exclusions from `context-map.json` and the mapping entry.
5. Load only the minimum set of context assets needed to satisfy outcomes and quality gates.
6. Validate answers and changes against authoritative source docs and tests.

## Context Assembly Priority and Ordering Rules

Use `foundation-domain-implementation-optional-v1` for initial task categories and keep tier order fixed:

1. `foundation` (first-tier, required): routing contracts, context-pack foundations, governance constraints.
2. `domain` (first-tier, required): category-mapped architecture/contributor docs tied to `changedPaths` and `primarySurfaces`.
3. `implementation` (second-tier, conditional): implementation-specific references for touched code paths and quality gates.
4. `optional` (second-tier, opt-in): supporting material only when unresolved gaps remain.

Rationale:

- First-tier context (`foundation`, `domain`) carries canonical decision authority and must be assembled first.
- Second-tier context (`implementation`, `optional`) is additive and should never displace first-tier authority.
- Keep token usage low by loading tier 3 and tier 4 only when outcome requirements cannot be met from tier 1 and tier 2.
- Remove tier 4 sources first when prompt size is constrained.

## Minimum Sufficient Context Rules

Use the smallest context set that can still produce a correct answer:

- Start with mapped packs in deterministic order (`repository-overview`, then `architecture-core`, then category-specific domain packs, then `context-system-foundations`) and the mapping's `relatedDocPaths`.
- For runtime/host/desktop/startup tasks, insert `runtime-and-host` after `architecture-core` and before `context-system-foundations`.
- For identity/authentication/authorization/trust/secrets-sensitive tasks, insert `identity-and-security` after `architecture-core` and before `context-system-foundations`.
- For Studio Shell and System Studio composition tasks, insert `studio-and-system-composition` after `architecture-core` and before `context-system-foundations`.
- Add ADR references only when decisions materially constrain implementation outcomes (for example control-plane authority, trust boundary enforcement, or studio/system authority).
- Add path-specific architecture or contributor docs only when they directly match `changedPaths` or `primarySurfaces`.
- Prefer one canonical source over multiple overlapping summaries.
- Stop adding documents once requested outcomes can be satisfied with confidence.
- If the prompt grows with duplicate or weakly related docs, remove lowest-signal assets first.

## Signal-to-Noise Guardrails

- Prioritize canonical contracts and architecture references over secondary summaries.
- Keep prompts scoped to declared paths; avoid whole-repo context loads.
- Do not mix unrelated categories in one route unless task decomposition explicitly requires separate runs.
- Exclude deprecated packs and excluded pack IDs before considering fallback behavior.
- Require explicit justification before adding documents outside the mapped domain.

## Explicit Exclusion Rules by Task Class

Apply these exclusions even when files look adjacent or partially relevant:

- `architecture-review`: exclude stale historical baselines and superseded migration snapshots when a canonical architecture reference exists for the same boundary.
- `feature-decomposition`: exclude implementation-deep diagnostics artifacts unless the decomposition task explicitly includes incident triage deliverables.
- `coding-implementation`: exclude overlapping non-authoritative summaries when canonical architecture or contract docs cover the same behavior.
- `migration-refactor`: exclude feature-planning narratives that are not required to preserve behavioral parity.
- `diagnostics`: exclude adjacent-workflow packs focused on long-horizon planning or UX design unless root-cause evidence points to those domains.
- `ui-studio`: exclude backend-only architecture domains that have no direct UI contract or state-flow impact.
- `runtime-security`: exclude non-security convenience docs when policy/authorization/secrets contracts are available for the touched paths.
- `documentation-change`: exclude runtime implementation-only context unless docs are being updated to reflect verified runtime behavior changes.

For all categories, explicitly exclude:

- stale historical material when a newer canonical source exists;
- baseline snapshots unless requested outcomes explicitly require historical evidence;
- superseded pointer docs unless the task is pointer maintenance, redirect validation, or migration traceability;
- unrelated architecture domains not present in `changedPaths` or `primarySurfaces`;
- overlapping but non-authoritative files when authoritative contracts/docs are available;
- context packs intended only for adjacent workflows.

## Authoritative vs Related Material Selection

Use this deterministic source precedence:

1. Include authoritative sources first: routing contracts, mapping-selected canonical docs, and path-matched architecture references.
2. Treat related-but-non-authoritative material as optional context only, never as decision authority.
3. Add related material only with an explicit justification tied to a missing fact not present in authoritative sources.
4. Remove related material first when prompt size or relevance degrades.
5. If authoritative and related sources conflict, keep authoritative sources and log the related source as context-only.

## Task-Type Routing Guidance (AI Loom Repository)

### `architecture-review`

Use when reviewing boundaries, host composition seams, or contract implications.

Primary docs:
- `docs/context/packs/runtime-and-host.pack.md`
- `docs/architecture/authoritative-server-host-assembly.md`
- `docs/architecture/desktop-host-assembly.md`
- `docs/architecture/worker-host-assembly.md`
- `docs/architecture/studio-handoff-contract.md`

Typical code surfaces:
- `src/hosts/`
- `src/application/`

### `feature-decomposition`

Use when converting epics or stories into sequenced implementation slices.

Primary docs:
- `docs/architecture/README.md`
- `docs/context/documentation-segmentation-taxonomy.md`
- `docs/context/routing/prompt-routing-contract.md`

Typical code surfaces:
- `src/application/`
- `src/domain/`

### `coding-implementation`

Use for behavior-changing code work with tests and docs alignment.

Primary docs:
- `docs/context/packs/runtime-and-host.pack.md`
- `docs/architecture/workflow-execution-and-tools.md`
- `docs/architecture/authoritative-server-host-assembly.md`
- `docs/contributors/docs-foundation-validation.md`

Typical code surfaces:
- `src/application/`
- `src/domain/`
- `src/infrastructure/`
- `src/hosts/`

### `migration-refactor`

Use for structural changes that preserve behavior.

Primary docs:
- `docs/architecture/README.md`
- `docs/context/routing/prompt-routing-contract.md`

Typical code surfaces:
- modules moved across `src/application/`, `src/domain/`, or `src/infrastructure/` with parity checks.

### `diagnostics`

Use for regressions, startup failures, and root-cause work.

Primary docs:
- `docs/context/packs/runtime-and-host.pack.md`
- `docs/architecture/authoritative-server-host-assembly.md`
- `docs/architecture/desktop-host-assembly.md`
- `docs/unified-api-observability-troubleshooting.md`

Typical code surfaces:
- `src/hosts/`
- `src/infrastructure/runtime/`

### `ui-studio`

Use for Studio/System UX and interaction-flow changes.

Primary docs:
- `docs/context/packs/studio-and-system-composition.pack.md`
- `docs/ui/README.md`
- `docs/architecture/studio-handoff-contract.md`
- `docs/architecture/image-workflow-system-definition-layer.md`
- `docs/architecture/image-manipulation-studio-interaction-model.md`

Typical code surfaces:
- `src/ui/`
- `src/application/workflow-studio/`

### `runtime-security`

Use for policy, authorization, and runtime safety boundaries.

Primary docs:
- `docs/context/packs/identity-and-security.pack.md`
- `docs/architecture/authorization-foundation.md`
- `docs/architecture/transport-security-foundation.md`
- `docs/architecture/secrets-foundation.md`

Typical code surfaces:
- security-sensitive paths under `src/application/`, `src/infrastructure/`, and host startup boundaries.

### `documentation-change`

Use for context/router/contract documentation updates.

Primary docs:
- `docs/context/routing/README.md`
- `docs/context/context-asset-metadata.md`
- `docs/contributors/router-overview-writing-standard.md`
- `docs/contributors/docs-placement-guide.md`

Typical code surfaces:
- `docs/context/`
- `docs/architecture/`
- `docs/contributors/`
- related `dev/tests/` guardrails

## Ambiguous Task Handling

When tasks span multiple categories or are underspecified:

1. Extract missing required signals (`changedPaths`, constraints, expected outcomes).
2. Choose the highest-risk category first (for example, `runtime-security` over `coding-implementation` when policy boundaries are touched).
3. If still ambiguous, run decomposition first using `feature-decomposition`, then route each resulting slice independently.
4. Document the selected category and why alternatives were excluded.
5. Re-route if newly discovered paths or constraints invalidate the initial choice.

Do not combine broad multi-category context into a single overloaded prompt when separate deterministic passes are possible.

## Concrete Repository Examples

### Example A: Feature decomposition for context engineering slices

Task request:
- "Break Epic 2.2 work into implementation-ready stories with tests and docs expectations."

Routing inputs:
- `taskCategory`: `feature-decomposition`
- `changedPaths`: `docs/context/routing`, `docs/architecture`, `src/application`, `src/domain`
- `requestedOutcomes`: `slice-plan`, `dependency-order`, `test-and-docs-plan`

Expected context assembly:
- Pack order: `repository-overview`, `architecture-core`, `context-system-foundations`
- Ordered docs:
1. `docs/architecture/README.md`
2. `docs/context/documentation-segmentation-taxonomy.md`
3. `docs/context/routing/prompt-routing-contract.md`

Explicit exclusions:
- `docs/baselines/README.md` (historical baseline routing is opt-in, not default decomposition context)
- `docs/unified-api-observability-troubleshooting.md` (diagnostics-only depth not required for planning)
- runtime incident triage artifacts in `src/infrastructure/runtime/`

Why this route:
- Keep decomposition architecture-first and avoid implementation-deep troubleshooting context noise.

### Example B: Documentation restructuring for routing and governance docs

Task request:
- "Restructure context-routing docs and keep `.md` + `.ai.md` pairs aligned with guardrails."

Routing inputs:
- `taskCategory`: `documentation-change`
- `changedPaths`: `docs/context`, `docs/contributors`, `dev/tests`
- `requestedOutcomes`: `authoritative-doc-update`, `metadata-alignment`, `guardrail-test-update`

Expected context assembly:
- Pack order: `repository-overview`, `architecture-core`, `documentation-refactor`, `context-system-foundations`
- Ordered docs:
1. `docs/context/routing/README.md`
2. `docs/context/context-asset-metadata.md`
3. `docs/contributors/router-overview-writing-standard.md`
4. `docs/contributors/docs-placement-guide.md`

Explicit exclusions:
- `docs/baselines/README.md` (historical baseline references are loaded only when explicitly requested)
- `docs/architecture/workflow-execution-and-tools.md` (implementation-centric, not docs-router authority)
- host runtime diagnostics docs unless a docs claim depends on runtime behavior evidence

Why this route:
- Keep source authority with context contracts and contributor docs standards, not runtime implementation references.

### Example C: Architecture review for host boundary changes

Task request:
- "Review server/desktop/worker host boundary changes before implementation and guardrail updates."

Routing inputs:
- `taskCategory`: `architecture-review`
- `changedPaths`: `src/hosts`, `src/application`, `docs/architecture`, `dev/tests/HostCompositionArchitectureGuardrails.test.ts`
- `requestedOutcomes`: `boundary-review`, `contract-impact-summary`, `recommended-change-plan`

Expected context assembly:
- Pack order: `repository-overview`, `architecture-core`, `runtime-and-host`, `context-system-foundations`
- Ordered docs:
1. `docs/architecture/authoritative-server-host-assembly.md`
2. `docs/architecture/desktop-host-assembly.md`
3. `docs/architecture/worker-host-assembly.md`
4. `docs/architecture/studio-handoff-contract.md`

Explicit exclusions:
- stale baseline snapshots superseded by current architecture references
- UI-only docs in `docs/ui/` when host contract boundaries are the primary surface

Why this route:
- Deterministic host-assembly ordering keeps contract-level authority ahead of adjacent workflow material.

### Example D: Runtime troubleshooting for host startup regression

Task request:
- "Investigate a startup regression in authoritative host bootstrapping and deliver a minimal safe fix."

Routing inputs:
- `taskCategory`: `diagnostics`
- `changedPaths`: `src/hosts`, `src/infrastructure/runtime`, `dev/tests/HostDevelopmentStartupScripts.test.ts`
- `requestedOutcomes`: `root-cause`, `minimal-fix`, `regression-test`

Expected context assembly:
- Pack order: `repository-overview`, `architecture-core`, `runtime-and-host`, `context-system-foundations`
- Ordered docs:
1. `docs/architecture/authoritative-server-host-assembly.md`
2. `docs/architecture/desktop-host-assembly.md`
3. `docs/unified-api-observability-troubleshooting.md`

Explicit exclusions:
- feature decomposition planning docs unless triage reveals planning-rooted contract gaps
- broad refactor narratives without reproduction evidence

Why this route:
- Keeps diagnostics focused on reproducibility and host/runtime evidence before unrelated planning context.

### Example F: Runtime-host implementation fix for startup readiness

Task request:
- "Implement a host-startup readiness fix for desktop post-login runtime initialization and add targeted regression coverage."

Routing inputs:
- `taskCategory`: `coding-implementation`
- `changedPaths`: `src/hosts/desktop`, `src/hosts/bootstrap`, `electron/main/runtime`, `dev/tests/HostDevelopmentStartupScripts.test.ts`
- `requestedOutcomes`: `minimal-safe-runtime-fix`, `targeted-regression-tests`, `contract-aligned-doc-update`

Expected context assembly:
- Pack order: `repository-overview`, `architecture-core`, `runtime-and-host`, `context-system-foundations`
- Ordered docs:
1. `docs/architecture/host-bootstrap-pipeline.md`
2. `docs/architecture/desktop-post-login-runtime-lifecycle-contract.md`
3. `docs/architecture/desktop-auth-first-startup-boundary.md`

Explicit exclusions:
- `docs/ui/README.md` (UI guidance is not primary authority for startup runtime composition)
- `docs/architecture/secrets-foundation.md` (security foundation context is out of scope unless runtime evidence points there)

Why this route:
- Keeps implementation prompts bounded to host/runtime startup authority and avoids broad repository context noise.

### Example E: Studio/System workflow interaction change

Task request:
- "Adjust Studio/System handoff behavior and workflow-studio interaction sequencing."

Routing inputs:
- `taskCategory`: `ui-studio`
- `changedPaths`: `src/ui`, `src/application/workflow-studio`, `docs/ui`, `docs/architecture/studio-handoff-contract.md`
- `requestedOutcomes`: `ux-design-update`, `state-flow-alignment`, `validation-or-test-coverage`

Expected context assembly:
- Pack order: `repository-overview`, `architecture-core`, `studio-and-system-composition`, `context-system-foundations`
- Ordered docs:
1. `docs/architecture/studio-handoff-contract.md`
2. `docs/architecture/image-workflow-system-definition-layer.md`
3. `docs/architecture/image-manipulation-studio-interaction-model.md`
4. `docs/ui/README.md`

Explicit exclusions:
- backend-only security hardening docs with no UI contract impact
- runtime-only host startup artifacts not tied to studio state flow

Why this route:
- Preserves studio contract intent by loading UI and handoff authority before backend-adjacent documents.
