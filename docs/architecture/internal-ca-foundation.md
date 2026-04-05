# Internal CA Foundation

This note documents Story 6.1.1 and Story 6.1.3 (Feature 6 / Epic 6.1): the internal certificate-authority domain language, application service boundaries, and secure startup bootstrap validation path for root CA lifecycle, certificate issuance/revocation, rotation metadata, trust material references, and host startup safety checks.

## Canonical artifacts

- `src/domain/security/CertificateAuthorityDomain.ts`
- `src/domain/security/tests/CertificateAuthorityDomain.test.ts`
- `src/application/security/ports/ICertificateAuthorityRootPersistenceRepository.ts`
- `src/application/security/ports/IIssuedCertificatePersistenceRepository.ts`
- `src/application/security/ports/ITrustMaterialReferencePersistenceRepository.ts`
- `src/application/security/ports/ICertificateAuthorityIssuerPort.ts`
- `src/application/security/ports/ITrustMaterialDistributionPort.ts`
- `src/application/security/ports/ICertificateAuthorityBootstrapConfigurationProvider.ts`
- `src/application/security/ports/ICertificateAuthorityBootstrapSecretService.ts`
- `src/application/security/ports/CertificateAuthorityPorts.ts`
- `src/application/security/use-cases/ResolveCertificateAuthorityStartupStateUseCase.ts`
- `src/application/security/tests/CertificateAuthorityPortsContracts.test.ts`
- `src/application/security/tests/ResolveCertificateAuthorityStartupStateUseCase.test.ts`
- `src/infrastructure/security/InternalCertificateAuthorityBootstrapEnvironmentAdapter.ts`
- `src/infrastructure/security/tests/InternalCertificateAuthorityBootstrapEnvironmentAdapter.test.ts`
- `hosts/server/IdentityServerHost.ts`
- `hosts/server/tests/IdentityServerHost.test.ts`
- `src/shared/dto/security/CertificateAuthorityDtos.ts`
- `src/shared/dto/security/tests/CertificateAuthorityDtos.test.ts`
- `src/shared/schemas/security/CertificateAuthoritySchemaContracts.ts`
- `src/shared/schemas/security/tests/CertificateAuthoritySchemaContracts.test.ts`

## Scope and intent

Implemented in this story:

- internal CA root lifecycle model with explicit statuses (`active`, `retired`, `compromised`)
- issued certificate model for node/device/service references
- certificate serial-number, subject, usage, validity-window, and status vocabularies
- certificate revocation reason model and revocation record envelope
- rotation policy metadata model for CA lifecycle planning and overlap windows
- trust material reference model for certificate, key, chain, and CRL material
- application repository + issuer/distribution ports, without infrastructure coupling
- shared DTO and schema contracts for persistence/transport boundaries

Out of scope in this story:

- concrete crypto implementation for key generation, signing, and CRL generation
- concrete persistence adapters or schema migrations
- authoritative server transport handlers for CA operations

## Story 6.1.3 startup bootstrap behavior

Startup validation now uses an application use case (`ResolveCertificateAuthorityStartupStateUseCase`) so the host composition layer does not read CA material directly.

### Startup state model

- `uninitialized`
  - no persisted CA and no complete bootstrap material path is present
  - safe to continue startup while later initialization workflows are pending
- `initialized`
  - active CA is present and bootstrap config, trust metadata, and secret references are all coherent
- `invalid`
  - partial bootstrap config, missing trust metadata, missing secret material, or mismatched references
  - startup fails closed
- `revoked`
  - persisted CA status is compromised
  - startup fails closed
- `migration-required`
  - retired CA or bootstrap configuration/persistence mismatch requiring operator migration action
  - startup fails closed

### Bootstrap config and secret source seam

`InternalCertificateAuthorityBootstrapEnvironmentAdapter` provides production-oriented environment-backed adapters for:

- approved config loading (`AI_LOOM_INTERNAL_CA_*` keys)
- secret metadata checks via explicit `env:<VARIABLE_NAME>` references

The secret service seam validates presence only and intentionally keeps raw key handling outside host composition.

### Failure mode expectations

- unsafe partial states fail closed with structured diagnostics from the use case
- host startup calls `assertCertificateAuthorityStartupSafe` before bringing the server online
- diagnostics are structured for future operator/admin presentation surfaces

## Domain model summary

`CertificateAuthorityDomain.ts` defines:

- CA root aggregate: `CertificateAuthorityRoot`
- issued certificate aggregate: `IssuedCertificate`
- supporting value objects:
  - `CertificateSerialNumber`
  - `CertificateValidityWindow`
  - `CertificateSubjectDescriptor`
  - `CertificateSubjectReference`
  - `CertificateRevocationRecord`
  - `RotationPolicyMetadata`
  - `TrustMaterialReference`

Lifecycle helpers and guardrails include:

- CA status transition map (`CertificateAuthorityLifecycleTransitions`)
- CA status transition operation (`transitionCertificateAuthorityStatus`)
- certificate revocation operation (`revokeIssuedCertificate`)
- certificate supersession operation (`supersedeIssuedCertificate`)
- active-time evaluation helper (`isIssuedCertificateActiveAt`)
- rotation-policy update operation (`updateCertificateAuthorityRotationPolicy`)

## Application boundary summary

The application layer exposes explicit ports only:

- persistence boundaries:
  - `ICertificateAuthorityRootPersistenceRepository`
  - `IIssuedCertificatePersistenceRepository`
  - `ITrustMaterialReferencePersistenceRepository`
- crypto and distribution boundaries:
  - `ICertificateAuthorityIssuerPort`
  - `ITrustMaterialDistributionPort`
- grouped composition contracts:
  - `CertificateAuthorityPersistencePorts`
  - `CertificateAuthorityCryptoPorts`

These seams let later stories implement bootstrapping, issuance, lookup, revocation, and rotation workflows without importing infrastructure into domain/application code.

## Shared contract summary

`CertificateAuthorityDtos.ts` defines stable record/query/mutation contracts for:

- CA root persistence records
- issued certificate records
- trust material reference records
- revocation + rotation policy record envelopes
- lookup filters for CA roots, certificates, and trust materials
- idempotent mutation envelopes (`operationKey`, `expectedRevision`, actor context)

`CertificateAuthoritySchemaContracts.ts` adds zod validation and parse helpers for:

- CA root records
- issued certificate records
- trust material records
- typed schema validation errors with deterministic issue paths

## Test coverage

- `CertificateAuthorityDomain.test.ts`: lifecycle invariants, issuance/revocation/supersession behavior, rotation policy updates
- `CertificateAuthorityPortsContracts.test.ts`: repository contract assumptions for save/list/lookup/revoke/rotation/trust-material flows
- `CertificateAuthorityDtos.test.ts`: query preset and lookup-key helper behavior
- `CertificateAuthoritySchemaContracts.test.ts`: valid payload parsing and invalid payload rejection for CA/certificate/trust-material records

## Related architecture note

- Story 6.1.2 persistence schema and repository adapter details are documented in:
  - `docs/architecture/internal-ca-persistence-contracts.md`
