# Execution Plan Preparation (Phase 12)

## Purpose

Phase 12 defines **Execution Plan Preparation** as a workspace-scoped, non-executing planning layer.

> Phase 12 introduces workspace-scoped execution plan preparation that transforms a ready Phase 11 runtime readiness binding into a safe, inspectable, non-executing execution plan candidate. Execution plan preparation identifies planned steps, dependencies, inputs, outputs, provider adapter references, safety gates, resource estimates, and blockers without invoking providers, running workflows, loading models, starting runtimes, or generating executable payloads.

Phase 12 prepares future execution. Phase 12 does not execute.

## Core definitions

- **Execution plan preparation**: process that derives planning metadata from a runtime-readiness-backed composition context.
- **Execution plan**: workspace-owned planning record describing intended execution structure and safety posture.
- **Execution plan candidate**: a currently prepared, inspectable plan snapshot (not executable).
- **Execution step**: one planned unit of future work.
- **Execution step group**: ordered subset of related steps for review or dependency control.
- **Execution dependency**: a directed relationship where one step/input/output must be satisfied before another.
- **Execution input**: required or optional input descriptor for a step.
- **Execution output**: planned output descriptor for a step.
- **Execution artifact reference**: safe reference to planned artifact source/destination metadata.
- **Execution adapter reference**: safe reference to an adapter/capability needed for a step.
- **Provider adapter reference**: execution adapter reference scoped to provider capabilities chosen in readiness.
- **Execution safety gate**: non-executing check/review condition required before later execution orchestration may invoke anything.
- **Execution preflight**: non-executing validation of plan completeness and gate readiness.
- **Dry-run plan**: non-executing preview pass across plan structure and safety gates.
- **Execution preview**: user-inspectable rendering of the plan candidate.
- **Execution blocker**: condition that prevents safe handoff toward execution orchestration.
- **Execution diagnostic**: sanitized reason/details explaining state, risk, or blocker.
- **Execution resource estimate**: optional planning-only estimate categories.
- **Execution ordering**: explicit ordering intent derived from dependencies.
- **Execution dependency graph**: graph of step/input/output dependencies used for planning and review.
- **Execution handoff**: transfer of prepared plan metadata to a future execution orchestration phase.
- **Execution deferred**: explicit statement that invocation does not occur in Phase 12.
- **Executable payload deferred**: executable workflow/provider payload generation is deferred.
- **Provider invocation deferred**: provider calls are deferred.
- **Runtime invocation deferred**: runtime startup/task invocation is deferred.

UI wording should stay simpler (for example: “Preview plan”, “Check execution plan”, “Needs setup”, “Safety check needed”, “Nothing runs from this screen”).

## Conceptual model (planning metadata only)

### Execution plan record (conceptual)

- execution plan ID
- target workspace ID
- source composition plan ID
- source runtime readiness binding ID
- source readiness status/reference
- execution plan status
- planned steps
- step dependencies
- planned inputs
- planned outputs
- provider/adapter references
- safety gates
- blockers
- diagnostics
- resource estimates
- provenance
- created/updated timestamps
- archived timestamp (optional)

### Execution step (conceptual)

- step ID
- source composition node ID/relationship ID (if applicable)
- step kind
- safe label
- safe summary
- required provider/adapter reference
- required inputs
- expected outputs
- dependencies
- safety gates
- resource estimate
- blockers
- diagnostics

### Execution input (conceptual)

- input ID
- step ID
- input kind
- safe label
- source asset/projection/reference (if available)
- required/optional flag
- readiness status
- blocker/diagnostic summary

### Execution output (conceptual)

- output ID
- step ID
- output kind
- safe label
- destination reference type
- planned artifact reference (if available)
- readiness status
- blocker/diagnostic summary

### Execution adapter reference (conceptual)

- adapter reference ID
- provider kind
- capability kind
- safe label
- selected runtime readiness binding reference
- **no credentials**
- **no raw provider payloads**
- **no raw local paths**
- **no command lines**

All Phase 12 records are planning metadata only.

## Status model (conservative)

Allowed statuses:

- `draft`
- `preparing`
- `ready-for-review`
- `needs-setup`
- `missing-inputs`
- `missing-outputs`
- `provider-setup-required`
- `safety-review-required`
- `blocked`
- `stale`
- `invalid`
- `archived`

Clarifications:

- `ready-for-review` does **not** mean executable or ready-to-run.
- `ready-for-review` does **not** mean execution can start.
- `needs-setup` means setup/readiness metadata is insufficient.
- `missing-inputs` means required inputs cannot be safely planned.
- `missing-outputs` means safe output destination planning is incomplete.
- `provider-setup-required` means Phase 11 setup/readiness is insufficient or stale.
- `safety-review-required` means plan description exists but must not be handed to execution yet.
- `blocked` means safe handoff cannot proceed.
- `stale` means source composition/readiness changed and re-preparation is required.

Disallowed status language for Phase 12: `execution-ready`, `ready-to-run`, `running`, `completed`, `executed`, `deployed`, `launched`.

## Initial step kinds (Phase 12 baseline vocabulary)

- `prepare-input`
- `transform-data`
- `generate-image`
- `generate-text`
- `embed-content`
- `store-artifact`
- `read-artifact`
- `call-api`
- `compose-output`
- `validate-output`
- `manual-review`
- `safety-check`
- `provider-setup-check`
- `runtime-setup-check`

This is intentionally modest. Later phases may refine step kinds for concrete slices (for example ComfyUI-oriented flows).

## Safety gates, preflight, and dry-run boundary

Safety gates are non-executing checks/review points. Examples:

- required input available
- output destination planned
- provider setup selected
- storage destination safe
- no unresolved blockers
- user review required
- model/provider policy check required
- resource estimate within safe bounds
- execution preview reviewed
- credentials not embedded
- no raw path exposure
- no executable payload generated in Phase 12

Execution preflight / dry-run in Phase 12 means metadata validation and gate evaluation only. No runtime/provider/workflow execution is allowed.

## Resource estimates (optional, safe summaries)

May include:

- estimated step count
- estimated artifact count
- estimated input count
- estimated output count
- estimated provider categories
- estimated storage-needs category
- estimated compute category
- estimated duration category

Must not include secrets, raw paths, environment values, provider payloads, command lines, or execution benchmark/model-result output.

## Dependencies and boundaries

### Dependency on Phase 11 runtime readiness

Phase 12 depends on workspace-scoped readiness bindings and may read only safe readiness metadata (workspace, binding, source composition reference, readiness status, selected setup choices, safe provider/capability references, unresolved requirements, blockers/diagnostics, inventory/provenance summaries).

If readiness is missing/stale/blocked/invalid/archived/provider-unavailable/etc., Phase 12 must produce plan blockers and conservative statuses (`needs-setup`, `provider-setup-required`, `blocked`, `stale`, `invalid`) instead of bypassing readiness.

### Relationship to Phase 10 and Phase 9

- Phase 12 normally consumes Phase 11 binding references to Phase 10 composition plans.
- Phase 12 may consult composition summaries for safe step labels/source references.
- Phase 12 does not reconstruct Phase 9 projection internals.
- Phase 12 does not mutate projections, composition plans, readiness bindings, authoring records, user library records, asset kernel definitions, or `system.foundation`.

### Relationship to runtime/provider adapters

Phase 12 may reference safe adapter kinds/references from readiness. Phase 12 must not execute adapters, invoke providers/models, start runtimes, run shell commands, install dependencies, download models, inspect raw env/credential values, or generate provider invocation payloads.

### Relationship to hosts

- Desktop host may display execution previews and route plan-preparation requests.
- Server host may expose plan-preparation API surfaces.
- Thin client must not inspect local runtime/provider resources directly.
- No host executes workflows in Phase 12.

## What Phase 12 implements vs defers

Phase 12 implements planning metadata preparation and inspectable previews.

Phase 12 defers runtime/provider/workflow execution concerns, including executable payload generation, invocation lifecycle, progress, cancellation, artifact production, runtime logs, and execution sandboxing.

## Phase 13 handoff

Phase 13 is expected to handle **Execution Orchestration and Controlled Runtime Invocation**.

Phase 12 handoff target (conceptual only):

```ts
PreparedExecutionPlan {
  executionPlanId
  workspaceId
  compositionPlanId
  runtimeReadinessBindingId
  status
  plannedSteps[]
  plannedInputs[]
  plannedOutputs[]
  adapterReferences[]
  safetyGates[]
  blockers[]
  diagnostics[]
}
```

## Explicit non-goals (Phase 12 Prompt 1 baseline)

No runtime/workflow/model/ComfyUI execution, provider invocation, dependency install, model download, credential/secret creation or storage, shell/env mutation, executable workflow or provider payload generation, artifact generation, execution job lifecycle/progress/cancellation/runtime logs, pack import/export, marketplace/collaboration/live sync behavior, or source-record mutation.

## Phase 12 implementation sequence

1. Prompt 1 — Execution planning architecture baseline, ADR, docs, context pack.
2. Prompt 2 — Execution plan contract vocabulary.
3. Prompt 3 — Application ports and persistence adapters for execution plans.
4. Review A — Contracts, ports, persistence, and no-execution-boundary review.
5. Prompt 4 — Convert runtime-ready composition bindings into execution requirements/steps.
6. Prompt 5 — Provider-specific execution plan adapters, still non-executing.
7. Prompt 6 — Safety gates, dry-run validation, resource estimates, and blocker diagnostics.
8. Review B — Plan materialization semantics, safety gates, no-runtime-execution review.
9. Prompt 7 — Execution plan read model integration.
10. Prompt 8 — API/IPC/preload/client exposure.
11. Prompt 9 — Minimal UI inside Assets / Plans / Setup showing execution plan preview.
12. Prompt 10 — Docs closeout and Phase 12 final hardening.
13. Review C — Final Phase 12 closeout review.

Prompt 8 may later split into 8a/8b/8c if transport scope grows.


## Phase 12 handoff exclusions

Phase 12 handoff excludes credentials, secrets, raw env values, shell commands, command output, local paths, storage roots, raw workflow/provider payloads, runnable graph JSON, executable payloads, bytes/blobs/base64, and signed URLs.


## Phase 13 handoff note

Phase 12 remains preview-only and non-executing. The next phase is controlled conversational-system execution with explicit approval and supported runtime invocation boundaries; see `docs/architecture/controlled-conversational-system-execution.md` and ADR-0023.


Phase 13 handoff correction: execution plans that feed conversational execution must originate from asset-derived conversational system composition (foundation-referenced reusable assets), not from ad hoc runtime session structures.
