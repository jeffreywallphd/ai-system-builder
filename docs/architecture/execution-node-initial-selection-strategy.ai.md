# AI Companion: Execution Node Initial Selection Strategy

## Story scope

Story 5.3.2 adds the first authoritative node-selection service for image runs, built on top of existing run-to-node eligibility evaluation.

## Implemented files

- `src/application/nodes/ports/ExecutionNodeManagementPorts.ts`
- `src/application/nodes/use-cases/ImageRunExecutionNodeSelectionService.ts`
- `src/application/nodes/tests/ImageRunExecutionNodeSelectionService.test.ts`
- Human doc: `docs/architecture/execution-node-initial-selection-strategy.md`

## Core delivery

- Adds explicit selection contracts:
  - `ImageRunExecutionNodeSelectionOutcomes`
  - `ImageRunExecutionNodeSelectionDecision`
  - `IImageRunExecutionNodeSelectionServicePort`
- Adds `ImageRunExecutionNodeSelectionService` that:
  - evaluates candidates through `IImageRunNodeEligibilityEvaluationServicePort`,
  - ranks candidates deterministically,
  - selects one eligible node or emits structured no-selection outcomes.

## Deterministic ranking posture

- Decision rank: `eligible` -> `unavailable` -> `incompatible`
- Within same decision: fewer advisories, then fewer total findings
- Final tie-break: lexical `nodeId`

## No-placement posture

- `no-eligible-node` when candidates exist but none are routable
- `no-candidate-nodes` when filtering yields no candidate inventory
- Both outcomes include structured reason payloads for diagnostics

## Extension guidance

This seam is intentionally simple and can be upgraded to policy-rule scheduling later by replacing ranking inputs/comparators without moving selection logic into adapters or UI surfaces.
