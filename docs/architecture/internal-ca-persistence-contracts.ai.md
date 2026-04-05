# AI Companion: Internal CA Persistence Contracts

## Purpose

Quick baseline for Story 6.1.2 (Feature 6 / Epic 6.1): persistence contracts and SQLite schema for internal CA metadata, issued certificate records, revocation/status history, and trust-distribution references.

## Canonical files

- `src/application/security/ports/ICertificateAuthorityRootPersistenceRepository.ts`
- `src/application/security/ports/IIssuedCertificatePersistenceRepository.ts`
- `src/application/security/ports/ITrustMaterialReferencePersistenceRepository.ts`
- `src/application/security/ports/ICertificateLifecycleEventPersistenceRepository.ts`
- `src/application/security/ports/CertificateAuthorityPorts.ts`
- `src/shared/dto/security/CertificateAuthorityDtos.ts`
- `src/shared/schemas/security/CertificateAuthoritySchemaContracts.ts`
- `src/infrastructure/persistence/security/SqliteCertificateAuthorityPersistenceMigrations.ts`
- `src/infrastructure/persistence/security/CertificateAuthorityPersistenceMapper.ts`
- `src/infrastructure/persistence/security/SqliteCertificateAuthorityPersistenceAdapter.ts`
- `src/infrastructure/persistence/security/tests/SqliteCertificateAuthorityPersistenceAdapter.test.ts`

## Core persistence boundaries

- CA root metadata persistence
- issued certificate metadata persistence
- trust-material reference persistence
- lifecycle event persistence:
  - certificate status history events
  - certificate revocation history records
  - certificate distribution events

## Schema posture

- version table: `certificate_authority_repository_migrations`
- core tables:
  - `certificate_authorities`
  - `issued_certificates`
  - `certificate_status_history`
  - `certificate_revocations`
  - `trust_material_references`
  - `certificate_distribution_events`
  - `certificate_mutation_replays`

## Security/data-handling posture

- Persist metadata and protected references only.
- Avoid plaintext persistence for private keys and decrypted certificate/key payloads.
- Treat `storage_locator` and related locator refs as pointers to protected stores (vault/object store/HSM-backed systems).
- Story 6.1.4 concretely supports `secret-store:<ID>` locators for internal encrypted secret storage adapters.

## Adapter semantics

- migrations are applied lazily when adapter is first used
- schema-version guardrail blocks unsupported forward versions
- mutation replay support keyed by `operationKey`
- optional optimistic concurrency via `expectedRevision`
- issuance writes append status-history events
- revocation writes persist explicit revocation records

## Tests in this slice

- migration/table creation validation
- CA + certificate roundtrip persistence
- revocation and lifecycle history query behavior
- distribution-event persistence behavior
