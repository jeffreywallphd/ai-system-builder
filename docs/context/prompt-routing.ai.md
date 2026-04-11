# AI Companion: Prompt Routing Guidance

Use this guide to apply deterministic routing with low context noise for AI Loom tasks.

## Canonical Routing Sources

Read in this order:

1. `docs/context/routing/task-to-context-routing.contract.json`
2. `docs/context/routing/task-to-context-routing.seed.json`
3. `docs/context/context-map.json`
4. `docs/context/routing/prompt-routing-contract.ai.md`

Machine-readable artifacts are authoritative for categories, selection modes, and priorities.

## Deterministic Routing Workflow

1. Assign one `taskCategory`.
2. Gather required routing fields: `taskSummary`, `taskCategory`, `requestedOutcomes`, `changedPaths`, `constraints`.
3. Resolve mapping entry from `task-to-context-routing.seed.json`.
4. Apply selection mode, assembly profile ordering, and exclusions from `context-map.json` and mapping metadata.
5. Load minimum sufficient context.
6. Validate output against authoritative docs and tests.

## Context Assembly Priority and Ordering Rules

Apply `foundation-domain-implementation-optional-v1` across initial categories with strict order:

1. `foundation` (first-tier, required): routing contracts, context foundations, governance constraints.
2. `domain` (first-tier, required): category-mapped domain docs scoped by changed paths and primary surfaces.
3. `implementation` (second-tier, conditional): implementation-specific references for touched surfaces and quality gates.
4. `optional` (second-tier, opt-in): support material only for explicit unresolved gaps.

Rationale:

- First-tier context is canonical and must be loaded before any lower-tier material.
- Second-tier context is additive and must not override first-tier authority.
- To minimize token waste, delay tier 3 and tier 4 until outcomes cannot be met with tier 1 and tier 2.
- Remove tier 4 first when context becomes noisy.

## Minimum Sufficient Context Rules

- Begin with mapped pack IDs and mapping `relatedDocPaths`.
- Add docs only when tied to `changedPaths`, `primarySurfaces`, or required quality gates.
- Prefer canonical contracts over secondary summaries.
- Stop when outcomes are satisfiable with high confidence.
- Remove low-signal or duplicate docs before adding new context.

## Signal-to-Noise Guardrails

- Keep routing path-scoped and category-scoped.
- Do not include deprecated or excluded packs.
- Avoid multi-category prompt assembly when separate deterministic passes are possible.
- Require explicit rationale for out-of-domain documents.
- Favor authoritative sources (`docs/architecture`, contracts, guardrail tests) over convenience notes.

## Explicit Exclusion Rules by Task Class

Apply these exclusions even when nearby files seem related:

- `architecture-review`: exclude stale historical baselines and superseded migration snapshots when canonical architecture references exist.
- `feature-decomposition`: exclude implementation-deep diagnostics artifacts unless incident triage is an explicit outcome.
- `coding-implementation`: exclude overlapping non-authoritative summaries when canonical contracts/architecture docs cover the same behavior.
- `migration-refactor`: exclude feature-planning narratives not required for behavioral parity.
- `diagnostics`: exclude adjacent-workflow packs for planning or UX unless reproduction evidence points there.
- `ui-studio`: exclude backend-only architecture domains without direct UI contract/state-flow impact.
- `runtime-security`: exclude non-security convenience docs when security/policy contracts are available.
- `documentation-change`: exclude runtime implementation-only context unless documenting verified runtime behavior changes.

Always exclude:

- stale historical material when newer canonical sources exist;
- unrelated architecture domains outside `changedPaths` and `primarySurfaces`;
- overlapping but non-authoritative files when authoritative sources exist;
- packs useful only for adjacent workflows.

## Authoritative vs Related Material Selection

Use this order:

1. Load authoritative sources first (contracts, mapped canonical docs, path-matched architecture references).
2. Treat related-but-non-authoritative sources as optional context only.
3. Add related sources only with explicit gap-based justification.
4. Remove related sources first when context becomes noisy.
5. Resolve conflicts in favor of authoritative sources and label related sources as context-only.

## Task-Type Routing Guidance (AI Loom Repository)

### `architecture-review`
Primary docs:
- `docs/architecture/authoritative-server-host-assembly.md`
- `docs/architecture/desktop-host-assembly.md`
- `docs/architecture/worker-host-assembly.md`
- `docs/architecture/studio-handoff-contract.md`
Primary surfaces:
- `src/hosts/`, `src/application/`

### `feature-decomposition`
Primary docs:
- `docs/architecture/README.md`
- `docs/baselines/README.md`
- `docs/context/routing/prompt-routing-contract.ai.md`
Primary surfaces:
- `src/application/`, `src/domain/`

### `coding-implementation`
Primary docs:
- `docs/architecture/workflow-execution-and-tools.md`
- `docs/architecture/authoritative-server-host-assembly.md`
- `docs/contributors/docs-foundation-validation.md`
Primary surfaces:
- `src/application/`, `src/domain/`, `src/infrastructure/`, `src/hosts/`

### `migration-refactor`
Primary docs:
- `docs/architecture/README.md`
- `docs/context/routing/prompt-routing-contract.ai.md`
Primary surfaces:
- behavior-preserving structural changes in `src/application/`, `src/domain/`, `src/infrastructure/`

### `diagnostics`
Primary docs:
- `docs/architecture/authoritative-server-host-assembly.md`
- `docs/architecture/desktop-host-assembly.md`
- `docs/unified-api-observability-troubleshooting.md`
Primary surfaces:
- `src/hosts/`, `src/infrastructure/runtime/`

### `ui-studio`
Primary docs:
- `docs/ui/README.md`
- `docs/architecture/studio-handoff-contract.md`
- `docs/architecture/image-manipulation-studio-interaction-model.md`
Primary surfaces:
- `src/ui/`, `src/application/workflow-studio/`

### `runtime-security`
Primary docs:
- `docs/architecture/authorization-foundation.md`
- `docs/architecture/transport-security-foundation.md`
- `docs/architecture/secrets-foundation.md`
Primary surfaces:
- security-sensitive runtime and host startup paths

### `documentation-change`
Primary docs:
- `docs/context/routing/README.ai.md`
- `docs/context/context-asset-metadata.ai.md`
- `docs/contributors/router-overview-writing-standard.ai.md`
- `docs/contributors/docs-placement-guide.ai.md`
Primary surfaces:
- `docs/context/`, `docs/architecture/`, `docs/contributors/`, related `dev/tests/`

## Ambiguous Task Handling

1. Collect missing required routing signals.
2. Select highest-risk category first.
3. If ambiguity remains, run `feature-decomposition` first and route resulting slices separately.
4. Record why selected category was chosen and alternatives excluded.
5. Re-route when new constraints or changed paths appear.

Never solve ambiguity by loading every nearby doc into one prompt.

## Concrete Repository Examples

### Example A: Feature decomposition for context engineering slices
- Task request: "Break Epic 2.2 work into implementation-ready stories with tests and docs expectations."
- Category: `feature-decomposition`
- Inputs: `docs/context/routing`, `docs/architecture`, `src/application`, `src/domain`
- Pack order: `context-system-foundations`
- Ordered docs:
1. `docs/architecture/README.md`
2. `docs/baselines/README.md`
3. `docs/context/routing/prompt-routing-contract.ai.md`
- Exclude diagnostics/runtime triage artifacts unless decomposition explicitly includes incident response outcomes.

### Example B: Documentation restructuring for routing governance
- Task request: "Restructure routing docs while keeping `.md` and `.ai.md` pairs aligned."
- Category: `documentation-change`
- Inputs: `docs/context`, `docs/contributors`, related `dev/tests`
- Pack order: `context-system-foundations`
- Ordered docs:
1. `docs/context/routing/README.ai.md`
2. `docs/context/context-asset-metadata.ai.md`
3. `docs/contributors/router-overview-writing-standard.ai.md`
4. `docs/contributors/docs-placement-guide.ai.md`
- Exclude implementation-focused runtime docs unless documentation claims depend on verified runtime behavior.

### Example C: Architecture review for host boundaries
- Task request: "Review server/desktop/worker host boundary changes before implementation."
- Category: `architecture-review`
- Inputs: `src/hosts`, `src/application`, `docs/architecture`, `dev/tests/HostCompositionArchitectureGuardrails.test.ts`
- Pack order: `context-system-foundations`
- Ordered docs:
1. `docs/architecture/authoritative-server-host-assembly.md`
2. `docs/architecture/desktop-host-assembly.md`
3. `docs/architecture/worker-host-assembly.md`
4. `docs/architecture/studio-handoff-contract.md`
- Exclude stale historical baselines and unrelated UI-only docs when host contracts are the primary surface.

### Example D: Runtime troubleshooting for startup regression
- Task request: "Investigate authoritative host startup regression and produce a minimal safe fix."
- Category: `diagnostics`
- Inputs: `src/hosts`, `src/infrastructure/runtime`, `dev/tests/HostDevelopmentStartupScripts.test.ts`
- Pack order: `context-system-foundations`
- Ordered docs:
1. `docs/architecture/authoritative-server-host-assembly.md`
2. `docs/architecture/desktop-host-assembly.md`
3. `docs/unified-api-observability-troubleshooting.md`
- Exclude feature-planning docs and broad refactor narratives unless reproduction evidence requires them.

### Example E: Studio/System interaction-flow update
- Task request: "Adjust Studio/System handoff behavior and workflow-studio interaction sequencing."
- Category: `ui-studio`
- Inputs: `src/ui`, `src/application/workflow-studio`, `docs/ui`, `docs/architecture/studio-handoff-contract.md`
- Pack order: `context-system-foundations`
- Ordered docs:
1. `docs/ui/README.md`
2. `docs/architecture/studio-handoff-contract.md`
3. `docs/architecture/image-manipulation-studio-interaction-model.md`
- Exclude backend-only security docs and runtime startup artifacts that do not change UI contract or state flow.
