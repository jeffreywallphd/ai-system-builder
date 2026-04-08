# AI Companion: Image System Domain Foundation

## What this slice adds

Story 2.1.2 introduces a dedicated typed image-system domain model that binds image workflow definitions into durable, reopenable, runnable system configurations.

## Canonical files

- `src/domain/systems/ImageSystemDomain.ts`
- `src/domain/systems/tests/ImageSystemDomain.test.ts`
- `docs/architecture/image-system-domain-foundation.md`

## Workflow/system separation

- Workflow definitions remain reusable contract resources (typed inputs, parameters, outputs, translation seams, lifecycle/versioning).
- System definitions are reusable/runnable saved configurations that pin a workflow version and store selected assets, output targets, and parameter baseline state.
- This avoids mixing workflow authoring concerns with per-system state continuity and keeps orchestration seams clean.

## Modeled contract

`ImageSystemDefinition` now carries:

- system identity and workspace ownership scope
- optional owner user and visibility/sharing posture
- display metadata (title/summary/tags)
- bound workflow identity/version/lineage/revision metadata
- required workflow binding ids (inputs/parameters/outputs)
- saved input asset selections
- saved output target bindings
- parameter baseline values and profile references
- lifecycle (`draft|ready|archived`) and runtime status (`enabled|disabled`)
- lineage seam for latest run/output continuity
- audit timestamps and actor metadata

## Core invariants

- private scope requires owner identity
- workflow binding scope must match system workspace
- bound workflow version tags must be semver and revisions non-negative
- logical references reject filesystem paths
- input/output binding ids are unique and constrained to bound workflow requirements
- only ready systems can be enabled
- archived systems are always disabled
- ready systems must pass readiness evaluation

## Readiness semantics

`evaluateImageSystemReadiness(...)` emits explicit issue codes for:

- missing required input selections
- missing required output target bindings
- unresolved required parameters (no baseline value and no profile reference)

`isImageSystemRunnable(...)` requires ready lifecycle, enabled runtime status, and zero readiness issues.

## Evolution seams

- lifecycle transitions are explicit and guarded
- runtime status updates are validated against readiness/lifecycle
- workflow rebinding resets to draft+disabled to force safe revalidation

## Boundary posture

- Domain-first modeling with no UI-only or transport-only assumptions.
- No embedded backend graph JSON or adapter-specific payloads.
- Ready for later run orchestration and lineage expansion without contract redesign.
