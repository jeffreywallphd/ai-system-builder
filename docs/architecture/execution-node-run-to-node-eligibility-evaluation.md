# Execution Node Run-to-Node Eligibility Evaluation for Image Runs

## Story alignment

- Feature 5: Node-Based Execution and Backend Management
- Epic 5.3: Node Eligibility, Run Assignment Seams, and Backend Selection Logic
- Story 5.3.1: Implement run-to-node eligibility evaluation for image runs

## Purpose

Provide a reusable, authoritative application-layer evaluator that answers whether a specific image run can execute on a specific execution node (or candidate node set) using normalized run requirements and current node capability/availability state.

## Implemented files

- `src/application/nodes/ports/ExecutionNodeManagementPorts.ts`
- `src/application/nodes/use-cases/ImageRunNodeEligibilityEvaluationService.ts`
- `src/application/nodes/tests/ImageRunNodeEligibilityEvaluationService.test.ts`

## Evaluation inputs

`ImageRunNodeEligibilityEvaluationService` evaluates:

- run context (`runId`, `workspaceId`, optional system/workflow/operation/translation identifiers)
- requirement envelopes (`requiredBackendFamilies`, operation/input/output requirements, node capabilities, remote scheduling requirement, translation contract version, degraded policy, freshness policy)
- compatibility hints already introduced by image workflow template metadata (`requiredOperationCapability`, required input/output kinds, translation backend families with readiness-check flags)
- current execution-node posture from authoritative node records (`approval`, `trust`, `activation`, `health`, backend capability metadata, operational availability override, backend readiness state)

## Eligibility rules

The service uses normalized requirements and `evaluateImageExecutionNodeCompatibility(...)` from `ExecutionNodeDomain` to classify each candidate node:

- `eligible`: node is compatible and routable for the run now
- `unavailable`: node is compatible but currently not routable (transient availability posture)
- `incompatible`: node fails hard compatibility requirements

Blocking and advisory behavior:

- hard incompatibilities remain blocking (`node-backend-family-unsupported`, missing required capabilities, unsupported operation/input/output/translation requirements)
- transient availability findings remain blocking for immediate routing (`node-health-not-routable`, stale freshness, suppression)
- soft advisories are non-blocking and preserved for explainability (`backend-readiness-degraded`, unmet resource-class preference)

Compatibility hints are merged only when their readiness-check flags are enabled, so template metadata can drive required checks without forcing unrelated constraints.

## Structured outputs

Each run-to-node result returns:

- decision (`eligible|unavailable|incompatible`)
- booleans (`eligible`, `compatible`, `routable`)
- matched backend/target metadata
- full findings, plus grouped `blockingReasons`, `advisories`, and `transientAvailabilityIssues`
- normalized requirement envelope used for evaluation
- summary with normalized reason-code buckets:
  - `blockingReasonCodes`
  - `advisoryReasonCodes`
  - `transientAvailabilityReasonCodes`
  - `findingCount`

These outputs are stable for orchestration filtering, readiness API projection, and future scheduler candidate policy.

## Selection-safety posture

The same service also implements existing execution-node eligibility and selection-hint service ports, so routing/scheduling consumers can consistently avoid obviously incompatible or unavailable nodes before dispatch preparation.

## Test coverage highlights

- eligible node with matching backend and operation requirements
- incompatible node (backend-family mismatch)
- unavailable node (transient health posture while otherwise compatible)
- degraded-node handling with advisory findings when degraded routing is allowed
- workflow compatibility-hint enforcement when explicit requirements are omitted
