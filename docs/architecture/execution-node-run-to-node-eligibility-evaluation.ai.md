# AI Companion: Execution Node Run-to-Node Eligibility Evaluation

## Story scope

Story 5.3.1 adds an application-layer run-to-node eligibility service for image runs, using authoritative node capability/availability state and normalized workflow/system requirements.

## Implemented files

- `src/application/nodes/ports/ExecutionNodeManagementPorts.ts`
- `src/application/nodes/use-cases/ImageRunNodeEligibilityEvaluationService.ts`
- `src/application/nodes/tests/ImageRunNodeEligibilityEvaluationService.test.ts`
- Human doc: `docs/architecture/execution-node-run-to-node-eligibility-evaluation.md`

## Core delivery

- Adds run-context-aware eligibility contracts:
  - `ImageRunNodeEligibilityRunContext`
  - `ImageRunNodeEligibilityRequirements`
  - `ImageRunNodeEligibilityResult`
  - `IImageRunNodeEligibilityEvaluationServicePort`
- Adds `ImageRunNodeEligibilityEvaluationService` that:
  - evaluates one run against one node or candidate node sets,
  - normalizes requirements and compatibility hints before evaluation,
  - classifies outcomes as `eligible|unavailable|incompatible`,
  - returns structured blocking reasons, advisories, transient issues, and reason-code summaries.
- Reuses existing domain compatibility evaluator (`evaluateImageExecutionNodeCompatibility`) to keep adapter payloads out of application policy logic.
- Implements existing execution-node eligibility and selection-hint service ports so orchestration/readiness/scheduler consumers can share one authoritative evaluation seam.

## Rule posture

- Hard incompatibilities block routing.
- Transient availability findings block immediate routing but preserve compatibility truth.
- Soft advisories are non-blocking and remain visible in outputs.
- Compatibility hints are applied only when readiness-check flags request enforcement.

## Validation posture

Tests cover eligible, incompatible, unavailable, and degraded-node scenarios plus compatibility-hint-driven requirement enforcement.
