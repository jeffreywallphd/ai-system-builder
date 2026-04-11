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
4. Apply selection mode and exclusions from `context-map.json` and mapping metadata.
5. Load minimum sufficient context.
6. Validate output against authoritative docs and tests.

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

### Example A: Host startup boundary review
- Category: `architecture-review`
- Inputs include `src/hosts/server` and `docs/architecture/authoritative-server-host-assembly.md`
- Route to `context-system-foundations` and host assembly docs, exclude unrelated UI docs.

### Example B: Workflow studio regression triage
- Category: `diagnostics`
- Inputs include `src/ui/studio-shell/workflow` and workflow routing tests
- Start with diagnostics docs; add UI docs only if contract clarification is required.

### Example C: Context routing documentation update
- Category: `documentation-change`
- Inputs include `docs/context` and related `dev/tests`
- Route to routing/context governance docs and update guardrail tests in-scope only.
