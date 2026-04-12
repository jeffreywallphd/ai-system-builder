# Execution Node Domain Model for Image Backend Hosting

## Story alignment

- Feature 5: Node-Based Execution and Backend Management
- Epic 5.1: Execution Node Domain, Capability Model, and Management Contracts
- Story 5.1.1: Define execution node domain model for image backend hosting

## Purpose

Define a domain-layer execution-node resource that treats backend execution environments as explicit trusted nodes, not implicit sidecars, with stable identity, capability metadata, lifecycle state, and image-execution eligibility seams.

## Implemented files

- `src/domain/nodes/ExecutionNodeDomain.ts`
- `src/domain/nodes/tests/ExecutionNodeDomain.test.ts`

## Domain model summary

`ExecutionNodeDomain` adds a dedicated execution-node aggregate for backend hosting:

- `ExecutionNodeRecord`
  - explicit identity and posture fields: `nodeId`, `displayName`, `nodeType`
  - capability profile and deployment metadata: `capabilityProfile`, `deploymentTags`
  - backend hosting metadata: `backendFamilyCapabilities` and supported execution targets
  - health/readiness surfaces: `activationStatus`, `healthStatus`, `lastSeenAt`
  - operational references: `endpoint.endpointRef` + optional `configurationRef`
  - trust-linkage fields used by orchestration policy seams: `approvalStatus`, `trustState`, `certificateRef`

- `ExecutionNodeBackendFamilyCapability`
  - links a node to one or more backend families (for example ComfyUI-backed image manipulation)
  - captures supported execution targets and profile/version tags without transport/protocol coupling

- `ImageExecutionEligibilityResult`
  - stable domain decision object for node-eligibility checks used by higher orchestration layers

## Lifecycle and invariant posture

The model introduces explicit activation lifecycle vocabulary:

- `inactive`
- `pending`
- `approved`
- `active`
- `degraded`
- `unavailable`
- `revoked`

Lifecycle transitions are constrained by `ExecutionNodeActivationLifecycleTransitions` and transition helpers.

Key invariants:

- execution nodes must include executor capability
- active/degraded/unavailable statuses require `approvalStatus=approved`
- active/degraded/unavailable statuses require `trustState=trusted` and `certificateRef`
- `activationStatus=revoked` must align with `trustState=revoked`
- `healthStatus=ready` requires `activationStatus=active`
- backend family capabilities are required and deduplicated
- timestamps are normalized and time-ordered

## Eligibility seam for image execution

`evaluateImageExecutionNodeEligibility(...)` evaluates routing eligibility for image execution based on:

- trust and approval posture
- activation and health readiness
- backend family support
- execution-target support (`image-manipulation` default)
- required node capabilities
- remote-scheduling requirement
- optional freshness window (`maxLastSeenAgeMs`)

This creates a policy-ready domain seam for later multi-node and hybrid-node scheduling without coupling to HTTP/persistence/UI/adapter protocol details.

## Boundary notes

- The model is domain-only and framework-neutral.
- It does not encode ComfyUI transport/protocol fields.
- User identity and run-state lifecycles remain separate concerns in their own domains.
- Trust and certificate infrastructure remain extensible through existing node-trust vocabulary rather than being reimplemented here.

