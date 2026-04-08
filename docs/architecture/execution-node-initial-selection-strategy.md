# Execution Node Initial Selection Strategy for Image Runs

## Story alignment

- Feature 5: Node-Based Execution and Backend Management
- Epic 5.3: Node Eligibility, Run Assignment Seams, and Backend Selection Logic
- Story 5.3.2: Implement initial backend-node selection strategy for the image slice

## Purpose

Provide an authoritative application-layer selection step that chooses a single execution node for an image run from currently evaluated candidates, without embedding selection policy in adapters, transport handlers, or UI logic.

## Implemented files

- `src/application/nodes/ports/ExecutionNodeManagementPorts.ts`
- `src/application/nodes/use-cases/ImageRunExecutionNodeSelectionService.ts`
- `src/application/nodes/tests/ImageRunExecutionNodeSelectionService.test.ts`

## Strategy summary (initial release)

`ImageRunExecutionNodeSelectionService` applies a deterministic eligible-first strategy:

1. Evaluate all candidate nodes through the existing `IImageRunNodeEligibilityEvaluationServicePort` contract.
2. Normalize ordering and rank candidates by:
   - eligibility decision (`eligible` before `unavailable` before `incompatible`),
   - advisory count (fewer advisories preferred),
   - total finding count (fewer findings preferred),
   - `nodeId` lexical tie-break (final deterministic tie-break).
3. Select the first `eligible` candidate.
4. If no `eligible` candidates exist, return a structured `no-eligible-node` decision.
5. If candidate resolution is empty, return a structured `no-candidate-nodes` decision.

This keeps the current image slice simple and production-safe while still explicit about why no placement occurred.

## Structured decision outputs

Selection returns `ImageRunExecutionNodeSelectionDecision` with:

- strategy identifier (`image-run-node-selection.v1.deterministic-eligible-first`)
- outcome (`selected`, `no-eligible-node`, `no-candidate-nodes`)
- optional selected node metadata
- ranked candidate list with decision and reason-code buckets
- structured reason objects for diagnostics and operator visibility

## Architectural boundaries

- Selection logic stays in application services, not in backend adapters.
- Eligibility remains authoritative and reusable through existing run-to-node evaluation ports.
- UI and API surfaces can consume selection decisions without owning policy semantics.

## Extension seams for future scheduling policy

Future policy-based scheduling can evolve this seam without breaking callers by:

- replacing the ranking comparator with policy-rule pipelines,
- introducing workload/capacity/deployment-profile inputs,
- adding reservation-aware or quota-aware ranking dimensions,
- expanding outcome/reason taxonomies while preserving deterministic tie-break behavior.

The current strategy intentionally avoids speculative scheduling features while preserving a stable contract for future policy engines.
