# Internal CA Persistence Contracts

This note documents Story 6.1.2 (Feature 6 / Epic 6.1): persistence schema planning and repository-facing contracts for internal CA and certificate lifecycle records.

## Canonical artifacts

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

## Scope and intent

- Add persistence-facing contracts for CA roots, issued certificates, trust-material references, lifecycle status history, revocation records, and trust distribution events.
- Define migration-ready SQLite schema blocks for durable certificate lifecycle storage across restarts.
- Keep secrets out of relational records by storing metadata and protected references only.

## Persistence model summary

Schema tracks:

- CA root records in `certificate_authorities`
- issued certificate records in `issued_certificates`
- explicit certificate status transitions in `certificate_status_history`
- explicit revocation history in `certificate_revocations`
- trust-material metadata references in `trust_material_references`
- trust distribution events in `certificate_distribution_events`
- idempotent mutation replay envelopes in `certificate_mutation_replays`

## Sensitive-material handling

Persisted:

- identifiers, lifecycle statuses, serial numbers, subject descriptors, usage metadata, validity windows
- protected references (`material_ref`, `storage_locator`, `delivery_locator_ref`) and audit stamps

Not persisted in plaintext:

- private keys
- full PEM/key content
- decrypted trust payloads

Story 6.1.4 implementation note:

- `storage_locator` entries may reference protected internal secret storage via `secret-store:<ID>` locators.
- locator targets are resolved through protected storage adapters, not direct filesystem payload reads in application/host logic.

## Repository seam expectations

- `ICertificateAuthorityRootPersistenceRepository`: create/read/update CA root metadata and rotation/status metadata
- `IIssuedCertificatePersistenceRepository`: create/read/update issued certificate metadata and current lifecycle state
- `ITrustMaterialReferencePersistenceRepository`: create/read/list trust-material metadata references
- `ICertificateLifecycleEventPersistenceRepository`:
  - append/list status history
  - save/list/find revocation history
  - save/list distribution events

`CertificateAuthorityPersistencePorts` now includes the lifecycle event repository so issuance/revocation/distribution use cases can compose auditable persistence paths.

## Adapter behavior

`SqliteCertificateAuthorityPersistenceAdapter` provides:

- lazy migration initialization with schema-version checks
- idempotent replay semantics keyed by `operationKey`
- optimistic-concurrency checks via `expectedRevision`
- automatic status-history insertion on issued certificate writes
- automatic revocation record persistence on certificate revocation writes

## Test coverage

- migration integrity and table existence checks
- roundtrip CA save/lookup
- issuance + revocation with status/revocation history lookup
- distribution-event persistence and query behavior
