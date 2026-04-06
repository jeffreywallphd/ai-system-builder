# AI Companion: Persistent Platform Domain Boundaries

## Purpose

Story 13.1.1 formalizes authoritative persistence boundaries across core platform domains so repository work remains domain-first and port-first.

## Canonical files

- `src/domain/platform/PlatformPersistenceBoundaries.ts`
- `src/domain/platform/tests/PlatformPersistenceBoundaries.test.ts`
- `src/application/common/ports/PlatformPersistenceBoundaryPorts.ts`
- `src/application/common/tests/PlatformPersistenceBoundaryPorts.test.ts`
- `docs/architecture/persistent-platform-domain-boundaries.md`

## Core boundary stance

- Authoritative server host is the single control-plane write authority.
- Domain/application layers define aggregates and repository targets.
- Infrastructure adapters implement those targets; they do not define business boundaries.
- Authoritative write models are distinct from query/read projections.

## Core domains covered

- identity
- workspaces
- authorization
- nodes
- storage
- assets
- runs
- security (internal CA + trust material references)
- secrets
- sessions
- audit

## Story 13.1.1 contract additions

- `IPlatformRunRecordRepository` in `src/application/common/ports/PlatformPersistenceBoundaryPorts.ts`
- `IPlatformAuditEventRepository` in `src/application/common/ports/PlatformPersistenceBoundaryPorts.ts`
- Shared mutation context/idempotency helper for future adapters:
  - `PlatformPersistenceMutationContext`
  - `normalizePlatformPersistenceOperationKey(...)`

## Story 13.1.2 contract additions

- Source-layer identity repository ports now exist for authoritative user/session persistence and query access:
  - `src/application/identity/ports/IIdentityLookupRepository.ts`
  - `src/application/identity/ports/IIdentityPersistenceRepository.ts`
  - `src/application/identity/ports/ICredentialMaterialRepository.ts`
  - `src/application/identity/ports/IIdentitySessionRepository.ts`
  - `src/application/identity/ports/IIdentitySessionTokenMaterialRepository.ts`
  - `src/application/identity/ports/IdentityRepositoryPorts.ts`
- Query/write split is explicit for credential material, sessions, and session-token material via dedicated query/write sub-interfaces.
- Shared identity persistence DTO contracts are now source-layer and reusable by adapters:
  - `src/shared/dto/identity/IdentityPersistenceDtos.ts`
- Contract tests added:
  - `src/application/identity/tests/IdentityRepositoryPortsContracts.test.ts`
  - `src/shared/dto/identity/tests/IdentityPersistenceDtos.test.ts`

## Ownership rules to preserve

- Workspace owns tenancy/membership lifecycle.
- Authorization owns policy/grant metadata and decision inputs.
- Storage owns storage-instance lifecycle/policy.
- Assets own logical asset lifecycle and upload-session records.
- Runs own execution status timeline and terminal truth.
- Security owns CA/certificate/trust-material lifecycle records.
- Secrets own scope/version metadata and encrypted material references.
- Sessions own auth session status/expiry/revocation truth.
- Audit owns append-only event ledger records.

