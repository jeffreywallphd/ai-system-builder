# AI Companion: Execution Node Domain Model for Image Backend Hosting

## Story scope

Story 5.1.1 introduces a dedicated domain model for execution-capable nodes that host image backends (for example ComfyUI-class integrations) as authoritative platform resources.

## Implemented files

- `src/domain/nodes/ExecutionNodeDomain.ts`
- `src/domain/nodes/tests/ExecutionNodeDomain.test.ts`
- Human doc: `docs/architecture/execution-node-domain-model-image-backend-hosting.md`

## Core delivery

- Adds `ExecutionNodeRecord` with explicit identity, trust posture linkage, lifecycle/readiness state, endpoint/config references, deployment tags, and backend-family hosting metadata.
- Adds `ExecutionNodeBackendFamilyCapability` to model backend-family support and execution-target eligibility (`image-manipulation` default target kind).
- Adds explicit activation lifecycle transitions and guarded transition helper (`transitionExecutionNodeActivationStatus`).
- Adds health observation and last-seen update seam (`recordExecutionNodeHealth`).
- Adds authoritative eligibility evaluator for image execution routing (`evaluateImageExecutionNodeEligibility`) with stable ineligibility reason codes.

## Invariant posture

- Execution nodes must include executor capability.
- Routable operational statuses require approved + trusted posture and certificate reference.
- Revocation posture is aligned with activation and trust status.
- Health/readiness values are constrained against activation posture.
- Backend-family capabilities are required, normalized, and deduplicated.

## Boundary posture

- Domain model only; no transport, persistence, UI, or backend protocol coupling.
- Node state stays separate from user-identity and run-state domains.
- Uses existing node-trust vocabulary for extensibility with later certificate/trust infrastructure stories.

