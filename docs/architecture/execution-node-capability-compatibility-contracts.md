# Execution Node Capability and Compatibility Contracts for Image Runs

## Story alignment

- Feature 5: Node-Based Execution and Backend Management
- Epic 5.1: Execution Node Domain, Capability Model, and Management Contracts
- Story 5.1.2: Define capability and compatibility contracts for image execution nodes

## Purpose

Define explicit contracts that compare image workflow/run requirements against trusted execution-node and backend-family capabilities so routing can remain deterministic, policy-aware, and scheduler-ready.

## Implemented files

- `src/domain/nodes/ExecutionNodeDomain.ts`
- `src/domain/nodes/tests/ExecutionNodeDomain.test.ts`

## Capability model extensions

`ExecutionNodeBackendFamilyCapability` now supports image-routing metadata in AI Loom execution terms:

- backend-family support for operation kinds and operation-capability ids
- supported input/output kinds used by template compatibility metadata
- supported translation contract versions
- resource-class hints for non-blocking placement guidance
- backend-family readiness profile (`ready`, `degraded`, `unavailable`, `unknown`)

These contracts stay backend-agnostic (no raw Comfy probe payloads are surfaced).

## Compatibility contracts

`ImageExecutionNodeCompatibilityRequirements` describes what a workflow/run needs:

- backend-family and execution-target requirements
- operation kind and required operation capability
- required input/output kinds and translation contract version
- required node role capabilities and remote-scheduling requirement
- preferred resource-class hints (advisory)
- freshness/degraded controls (`maxLastSeenAgeMs`, `allowDegraded`)

`ImageExecutionNodeCompatibilityResult` returns authoritative compatibility findings grouped as:

- `hard-incompatibility`: policy/contract blockers
- `soft-advisory`: non-blocking guidance
- `transient-availability`: temporary readiness/freshness constraints

The result exposes both:

- `compatible`: no hard incompatibilities
- `routable`: no hard incompatibilities and no transient availability blockers

## Evaluation behavior

`evaluateImageExecutionNodeCompatibility(...)` composes:

- existing node trust/eligibility constraints from `evaluateImageExecutionNodeEligibility(...)`
- backend-family capability checks against workflow/run requirements
- backend readiness and resource-class advisory interpretation

This provides a single domain seam that downstream run-assignment/readiness surfaces can consume without adapter-specific leakage.

## Test coverage highlights

`ExecutionNodeDomain.test.ts` now validates:

- hard incompatibility classification for missing required workflow input-kind support
- soft advisory classification for unmet preferred resource-class hints
- transient availability classification for backend-family readiness outages
