# Node Trust Persistence Contracts

This note documents Story 5.1.2 (Feature 5 / Epic 5.1): production-ready node trust persistence contracts for node identities and enrollment requests.

## Canonical artifacts

- `src/shared/dto/nodes/NodeTrustPersistenceDtos.ts`
- `src/shared/dto/nodes/tests/NodeTrustPersistenceDtos.test.ts`
- `src/shared/schemas/nodes/NodeTrustPersistenceSchemaContracts.ts`
- `src/shared/schemas/nodes/tests/NodeTrustPersistenceSchemaContracts.test.ts`
- `src/application/nodes/ports/INodeTrustIdentityPersistenceRepository.ts`
- `src/application/nodes/ports/INodeEnrollmentRequestPersistenceRepository.ts`
- `src/application/nodes/ports/NodeTrustPersistencePorts.ts`
- `src/application/nodes/tests/NodeTrustPersistencePortsContracts.test.ts`

## Scope and intent

- Define persistence-facing contracts for node trust and enrollment workflows without selecting a concrete storage adapter.
- Preserve explicit lifecycle state for approval, trust, enrollment status, revocation, and heartbeat observability.
- Keep query shapes and lookup keys indexing-friendly for common administration views and future scheduler/runtime checks.

## Contract summary

`NodeTrustPersistenceDtos.ts` introduces:

- shared mutation/audit contracts:
  - `NodeTrustPersistenceAuditStamp`
  - `NodeTrustPersistenceWriteContext`
  - `NodeTrustPersistenceMutationEnvelope`
  - `NodeTrustPersistenceMutationResult<TRecord>`
- node trust record contracts:
  - `NodeIdentityPersistenceRecord`
  - `NodeCapabilityProfilePersistenceRecord`
  - `NodeCertificateReferencePersistenceRecord`
  - `NodeLastSeenPersistenceRecord`
  - `NodeRevocationPersistenceRecord`
- enrollment record contracts:
  - `NodeEnrollmentRequestPersistenceRecord`
- query contracts:
  - `NodeIdentityPersistenceLookupQuery`
  - `NodeEnrollmentRequestPersistenceLookupQuery`
- mutation input contracts:
  - node registration
  - node approval status updates
  - certificate reference updates
  - capability profile updates
  - revocation updates
  - last-seen heartbeat updates
  - enrollment request save and status transition updates
- deterministic lookup helpers:
  - `toNodeCapabilityLookupKey`
  - `toNodeDeploymentTagLookupKey`
  - `toNodeTrustStateLookupKey`
  - `NodeTrustPersistenceQueryPresets`

## Repository seam expectations

Application ports define two explicit persistence responsibilities:

- `INodeTrustIdentityPersistenceRepository`:
  - register node identity trust records,
  - find/list nodes by trust, capability, and deployment metadata,
  - update approval, certificate, capability profile, revocation, and heartbeat fields.
- `INodeEnrollmentRequestPersistenceRepository`:
  - persist enrollment requests,
  - list/find requests including pending-by-node lookups,
  - transition enrollment status with review metadata.

`NodeTrustPersistencePorts` bundles both seams for use-case composition while keeping domain/application boundaries free of infrastructure detail.

## Query/index posture

Contracts are shaped for high-frequency query paths:

- pending enrollments:
  - `NodeTrustPersistenceQueryPresets.pendingEnrollmentRequestStatuses`
  - `findPendingEnrollmentRequestByNodeId(...)`
- active nodes:
  - `activeOnly` with `NodeTrustPersistenceQueryPresets.activeNodeTrustStates`
- revoked nodes:
  - `trustStates` + `includeRevoked`
- nodes by capability and deployment tags:
  - `capabilityAnyOf`, `deploymentTagAnyOf`
  - deterministic key helpers for index projection/materialized views.

## Schema validation contracts

`NodeTrustPersistenceSchemaContracts.ts` adds zod-backed schema validation for persistence records and parse helpers:

- `NodeIdentityPersistenceRecordSchema`
- `NodeEnrollmentRequestPersistenceRecordSchema`
- `parseNodeIdentityPersistenceRecord(...)`
- `parseNodeEnrollmentRequestPersistenceRecord(...)`

Validation locks core persistence invariants at the schema boundary:

- trusted records require approved status + certificate reference.
- revoked trust state requires revocation metadata.
- approved/rejected enrollment records require review timestamps.

## Test coverage

- `NodeTrustPersistenceDtos.test.ts` validates key derivation and operation-key normalization.
- `NodeTrustPersistenceSchemaContracts.test.ts` validates schema-level invariants and typed validation failures.
- `NodeTrustPersistencePortsContracts.test.ts` validates repository contract behavior for:
  - registration,
  - pending enrollment lookup,
  - approval/certificate/heartbeat updates,
  - revocation filtering and active/revoked list semantics.
