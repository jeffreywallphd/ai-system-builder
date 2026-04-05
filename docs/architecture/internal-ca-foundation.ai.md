# AI Companion: Internal CA Foundation

## What this slice does

- Defines a production-grade internal CA domain contract set in `src/domain/security/CertificateAuthorityDomain.ts`.
- Defines application ports for CA root persistence, certificate persistence, trust-material persistence, issuer crypto seams, and trust-bundle distribution seams.
- Adds shared DTO/schema contracts for CA and certificate records.
- Adds focused domain/port/DTO/schema tests for the new contract surface.
- Adds secure CA startup bootstrap validation seams (Story 6.1.3) for authoritative-host startup.

## Main artifacts to cite

- `src/domain/security/CertificateAuthorityDomain.ts`
- `src/application/security/ports/ICertificateAuthorityRootPersistenceRepository.ts`
- `src/application/security/ports/IIssuedCertificatePersistenceRepository.ts`
- `src/application/security/ports/ITrustMaterialReferencePersistenceRepository.ts`
- `src/application/security/ports/ICertificateAuthorityIssuerPort.ts`
- `src/application/security/ports/ITrustMaterialDistributionPort.ts`
- `src/application/security/ports/CertificateAuthorityPorts.ts`
- `src/application/security/ports/ICertificateAuthorityBootstrapConfigurationProvider.ts`
- `src/application/security/ports/ICertificateAuthorityBootstrapSecretService.ts`
- `src/application/security/use-cases/ResolveCertificateAuthorityStartupStateUseCase.ts`
- `src/infrastructure/security/InternalCertificateAuthorityBootstrapEnvironmentAdapter.ts`
- `hosts/server/IdentityServerHost.ts`
- `src/shared/dto/security/CertificateAuthorityDtos.ts`
- `src/shared/schemas/security/CertificateAuthoritySchemaContracts.ts`

## Domain vocabulary highlights

- CA status: `active`, `retired`, `compromised`
- certificate status: `issued`, `revoked`, `expired`, `superseded`
- subject reference targets: `node`, `device`, `service`
- revocation reasons include `key-compromise`, `ca-compromise`, `policy-violation`, and lifecycle-driven reasons
- rotation policy metadata includes auto-rotation flags plus lead/overlap/max-lifetime controls
- trust material references model certificate/key/chain/CRL persistence references without storage implementation leakage

## Boundary expectations

- Domain/application layers expose contracts and validation only.
- No infrastructure signing, key storage, or transport handlers are implemented in this story.
- Later stories should implement concrete bootstrap, issuance, revocation, rotation, and distribution behavior behind these ports.
- Host startup composes CA bootstrap checks through application use cases and adapters, not host-level raw secret/key handling.

## Story 6.1.3 startup-state model

- `uninitialized`: no persisted CA baseline yet
- `initialized`: CA metadata + trust metadata + secret references are coherent and ready
- `invalid`: partial/mismatched bootstrap state; fail closed
- `revoked`: CA status compromised; fail closed
- `migration-required`: retired CA or config/persistence mismatch requiring migration; fail closed

Structured diagnostics emitted by the startup use case are designed for future operator/admin surfaces.

## Coverage in this slice

- Domain invariants and lifecycle transitions: `src/domain/security/tests/CertificateAuthorityDomain.test.ts`
- Port contract assumptions: `src/application/security/tests/CertificateAuthorityPortsContracts.test.ts`
- Bootstrap startup state coverage: `src/application/security/tests/ResolveCertificateAuthorityStartupStateUseCase.test.ts`
- Environment adapter coverage: `src/infrastructure/security/tests/InternalCertificateAuthorityBootstrapEnvironmentAdapter.test.ts`
- Host fail-closed startup coverage: `hosts/server/tests/IdentityServerHost.test.ts`
- DTO helper coverage: `src/shared/dto/security/tests/CertificateAuthorityDtos.test.ts`
- schema parse/validation behavior: `src/shared/schemas/security/tests/CertificateAuthoritySchemaContracts.test.ts`

## Follow-on note

- Story 6.1.2 adds persistence schema + adapter details in:
  - `docs/architecture/internal-ca-persistence-contracts.ai.md`
