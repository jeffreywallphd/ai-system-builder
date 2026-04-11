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
4. Apply selection mode and exclusions from `context-map.json` and the mapping entry.
5. Load only the minimum set of context assets needed to satisfy outcomes and quality gates.
6. Validate answers and changes against authoritative source docs and tests.

## Minimum Sufficient Context Rules

Use the smallest context set that can still produce a correct answer:

- Start with the mapped pack (`context-system-foundations`) and the mapping's `relatedDocPaths`.
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

## Task-Type Routing Guidance (AI Loom Repository)

### `architecture-review`

Use when reviewing boundaries, host composition seams, or contract implications.

Primary docs:
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
- `docs/baselines/README.md`
- `docs/context/routing/prompt-routing-contract.md`

Typical code surfaces:
- `src/application/`
- `src/domain/`

### `coding-implementation`

Use for behavior-changing code work with tests and docs alignment.

Primary docs:
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
- `docs/architecture/authoritative-server-host-assembly.md`
- `docs/architecture/desktop-host-assembly.md`
- `docs/unified-api-observability-troubleshooting.md`

Typical code surfaces:
- `src/hosts/`
- `src/infrastructure/runtime/`

### `ui-studio`

Use for Studio/System UX and interaction-flow changes.

Primary docs:
- `docs/ui/README.md`
- `docs/architecture/studio-handoff-contract.md`
- `docs/architecture/image-manipulation-studio-interaction-model.md`

Typical code surfaces:
- `src/ui/`
- `src/application/workflow-studio/`

### `runtime-security`

Use for policy, authorization, and runtime safety boundaries.

Primary docs:
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

### Example A: Update host startup boundary docs and tests

Inputs:
- `taskSummary`: "Review startup composition updates for authoritative host and adjust guardrails."
- `changedPaths`: `src/hosts/server`, `docs/architecture/authoritative-server-host-assembly.md`, `dev/tests/HostCompositionArchitectureGuardrails.test.ts`
- `requestedOutcomes`: `boundary-review`, `minimal-change-plan`, `targeted-tests`

Route:
- `taskCategory`: `architecture-review`
- Load `context-system-foundations`, then host assembly docs in mapping order.
- Exclude UI-only docs because they are outside `changedPaths`.

### Example B: Fix studio workflow routing regression

Inputs:
- `taskSummary`: "Triage workflow studio mode routing regression after refactor."
- `changedPaths`: `src/ui/studio-shell/workflow`, `dev/tests/WorkflowStudioModeRouting.test.ts`
- `requestedOutcomes`: `root-cause`, `fix`, `regression-test`

Route:
- `taskCategory`: `diagnostics` (not `ui-studio` first, because current goal is triage).
- Start with diagnostics mapping docs, then add `docs/ui/README.md` only if UI contract clarification is needed.

### Example C: Add context routing documentation story updates

Inputs:
- `taskSummary`: "Add human-readable prompt routing guidance aligned to the routing seed."
- `changedPaths`: `docs/context`, `dev/tests`
- `requestedOutcomes`: `authoritative-doc-update`, `guardrail-test-update`

Route:
- `taskCategory`: `documentation-change`
- Use context routing and contributor writing-standard docs as primary sources.
- Keep scope bounded to routing and governance references required for this story.
