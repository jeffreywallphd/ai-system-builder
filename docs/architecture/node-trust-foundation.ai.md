# AI Companion: Node Trust Foundation

## Purpose

Quick baseline for Feature 5 / Epic 5.1 node-trust inner-layer contracts.

## Canonical files

- `src/domain/nodes/NodeTrustDomain.ts`
- `src/domain/nodes/tests/NodeTrustDomain.test.ts`

## Core model

- Entity: `NodeIdentity`
- Entity: `NodeEnrollmentRequest`
- Value object: `NodeCapabilityProfile`
- Value object: `LastSeenMetadata`
- Value object: `NodeRevocation`
- Enums:
  - `NodeType`
  - `NodeRoleCapability`
  - `NodeApprovalStatus`
  - `NodeTrustState`
  - `NodeRevocationState`
  - `NodeEnrollmentRequestStatus`

## Lifecycle and invariants

- Node approval transitions are explicit in `NodeApprovalLifecycleTransitions`.
- Node trust transitions are explicit in `NodeTrustLifecycleTransitions`.
- Enrollment-request transitions are explicit in `NodeEnrollmentRequestLifecycleTransitions`.
- Trusted nodes require:
  - `approvalStatus=approved`
  - `certificateRef`
- Revoked nodes require:
  - `trustState=revoked`
  - `revocation.state=revoked`
  - `revokedAt` + revocation reason
- Last-seen timestamps are normalized and cannot predate enrollment timestamps.
- Capability profiles are modeled as explicit enabled-capability sets, not single-role assumptions.
- Capability profiles use canonical capabilities:
  - `ui`
  - `api`
  - `scheduler`
  - `executor`
  - `storage-access`
  - `preview-worker`
- Capability profile guardrails:
  - `ui` requires `api`
  - `scheduler` requires `api` + `executor`
  - `preview-worker` requires `executor`
  - `supportsRemoteScheduling=true` requires `executor`
  - `maxConcurrentWorkloads` requires `executor`

## Tests in this slice

- `src/domain/nodes/tests/NodeTrustDomain.test.ts`
