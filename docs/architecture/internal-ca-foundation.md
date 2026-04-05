# Internal CA Foundation

This note documents Story 6.1.1, Story 6.1.3, Story 6.1.4, Story 6.1.5, Story 6.1.6, Story 6.2.1, Story 6.2.2, Story 6.2.3, Story 6.2.4, Story 6.2.5, Story 6.2.6, and Story 6.2.7 (Feature 6 / Epic 6.1 and Epic 6.2): the internal certificate-authority domain language, application service boundaries, secure startup bootstrap validation, protected storage/loading for CA root materials, first-time CA initialization orchestration, CA status/introspection query services, certificate subject-profile issuance policy enforcement, concrete issuance signing/material persistence execution, node-trust-backed approved-node issuance eligibility, explicit certificate revocation workflow plus revocation-status enforcement seams, reusable certificate trust evaluation helpers, certificate lifecycle audit recording seams, and issued-certificate metadata query/listing seams for admin/API consumers.
This note now also documents Story 6.3.1 and Story 6.3.2 (Feature 6 / Epic 6.3): runtime trust-material export/distribution contracts plus centralized certificate renewal/rotation planning services that classify renewal urgency and operator attention conditions before expiry.

## Canonical artifacts

- `src/domain/security/CertificateAuthorityDomain.ts`
- `src/domain/security/CertificateIssuancePolicyDomain.ts`
- `src/domain/security/tests/CertificateAuthorityDomain.test.ts`
- `src/domain/security/tests/CertificateIssuancePolicyDomain.test.ts`
- `src/application/security/ports/ICertificateAuthorityRootPersistenceRepository.ts`
- `src/application/security/ports/IIssuedCertificatePersistenceRepository.ts`
- `src/application/security/ports/ITrustMaterialReferencePersistenceRepository.ts`
- `src/application/security/ports/ICertificateAuthorityIssuerPort.ts`
- `src/application/security/ports/ITrustMaterialDistributionPort.ts`
- `src/application/security/ports/ICertificateAuthorityBootstrapConfigurationProvider.ts`
- `src/application/security/ports/ICertificateAuthorityBootstrapSecretService.ts`
- `src/application/security/ports/ICertificateAuthorityRootMaterialStorage.ts`
- `src/application/security/ports/INodeCertificateEligibilityPort.ts`
- `src/application/security/ports/ICertificateRevocationStatusRegistry.ts`
- `src/application/security/ports/CertificateLifecycleAuditPorts.ts`
- `src/application/security/ports/CertificateQueryAuthorizationPorts.ts`
- `src/application/security/ports/CertificateRuntimeTrustMaterialAuthorizationPort.ts`
- `src/application/security/ports/CertificateAuthorityPorts.ts`
- `src/application/security/use-cases/ResolveCertificateAuthorityStartupStateUseCase.ts`
- `src/application/security/use-cases/InitializeCertificateAuthorityUseCase.ts`
- `src/application/security/use-cases/GetCertificateAuthorityStatusIntrospectionUseCase.ts`
- `src/application/security/use-cases/IssueCertificateForSubjectUseCase.ts`
- `src/application/security/use-cases/RevokeIssuedCertificateUseCase.ts`
- `src/application/security/use-cases/ResolveCertificateRevocationStatusUseCase.ts`
- `src/application/security/use-cases/CertificateTrustEvaluationService.ts`
- `src/application/security/use-cases/ListIssuedCertificateMetadataUseCase.ts`
- `src/application/security/use-cases/GetIssuedCertificateMetadataUseCase.ts`
- `src/application/security/use-cases/ResolveRuntimeTrustMaterialPackageUseCase.ts`
- `src/application/security/use-cases/CertificateRenewalPlanningService.ts`
- `src/application/security/use-cases/GetCertificateRenewalPlanningUseCase.ts`
- `src/application/nodes/use-cases/ResolveApprovedNodeCertificateEligibilityUseCase.ts`
- `src/application/security/tests/CertificateAuthorityPortsContracts.test.ts`
- `src/application/security/tests/ResolveCertificateAuthorityStartupStateUseCase.test.ts`
- `src/application/security/tests/InitializeCertificateAuthorityUseCase.test.ts`
- `src/application/security/tests/GetCertificateAuthorityStatusIntrospectionUseCase.test.ts`
- `src/application/security/tests/IssueCertificateForSubjectUseCase.test.ts`
- `src/application/security/tests/RevokeIssuedCertificateUseCase.test.ts`
- `src/application/security/tests/ResolveCertificateRevocationStatusUseCase.test.ts`
- `src/application/security/tests/CertificateTrustEvaluationService.test.ts`
- `src/application/security/tests/CertificateLifecycleAuditPorts.test.ts`
- `src/application/security/tests/IssuedCertificateMetadataQueryUseCases.test.ts`
- `src/application/security/tests/ResolveRuntimeTrustMaterialPackageUseCase.test.ts`
- `src/application/security/tests/CertificateRenewalPlanningService.test.ts`
- `src/application/security/tests/GetCertificateRenewalPlanningUseCase.test.ts`
- `src/application/nodes/tests/ResolveApprovedNodeCertificateEligibilityUseCase.test.ts`
- `src/infrastructure/security/InternalCertificateAuthorityBootstrapEnvironmentAdapter.ts`
- `src/infrastructure/security/encryption/ScopedAesGcmEncryptionService.ts`
- `src/infrastructure/security/secrets/FileSystemProtectedSecretStore.ts`
- `src/infrastructure/security/ca/ProtectedCertificateAuthorityRootMaterialStorage.ts`
- `src/infrastructure/security/ca/InternalCertificateAuthorityIssuer.ts`
- `src/infrastructure/security/certificates/RuntimeTrustMaterialDistributionService.ts`
- `src/infrastructure/security/tests/InternalCertificateAuthorityBootstrapEnvironmentAdapter.test.ts`
- `src/infrastructure/security/secrets/tests/FileSystemProtectedSecretStore.test.ts`
- `src/infrastructure/security/ca/tests/ProtectedCertificateAuthorityRootMaterialStorage.test.ts`
- `src/infrastructure/security/ca/tests/InternalCertificateAuthorityIssuer.test.ts`
- `src/infrastructure/security/certificates/tests/RuntimeTrustMaterialDistributionService.test.ts`
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

- full CRL generation/distribution workflows and automated rotation orchestration
- authoritative server transport handlers for CA operations

## Story 6.2.2 certificate issuance signing pipeline

Story 6.2.2 adds the concrete end-to-end certificate issuance execution path:

- `InternalCertificateAuthorityIssuer` now provides a production signing adapter for:
  - CA root keypair/certificate generation (`initializeInternalCertificateAuthority`)
  - leaf certificate signing (`issueCertificateMaterial`) using persisted CA root key/cert material
  - deterministic serial creation, validity clamping, certificate fingerprint outputs, and chain output
- `IssueCertificateForSubjectUseCase` now persists protected issued certificate/chain artifacts plus trust-material metadata references in the issuance path before final issued-certificate metadata write.
- issuance emits redacted structured audit events (`certificate-issuance-started|succeeded|failed`) without exposing secret refs or plaintext material.
- issuance failure handling now includes best-effort compensating revocation when post-signing persistence fails, so failure is bounded and explicit.

## Story 6.2.3 node approval integration for issuance eligibility

Story 6.2.3 aligns certificate issuance trust with node-trust lifecycle evidence:

- `IssueCertificateForSubjectUseCase` now gates `approved-node` issuance through `INodeCertificateEligibilityPort` instead of reading node persistence directly.
- `ResolveApprovedNodeCertificateEligibilityUseCase` implements the node-trust integration seam and validates:
  - node approval/trust-state eligibility,
  - revocation state and revocation timestamps,
  - enrollment linkage and approved enrollment status,
  - capability-profile integrity and enrollment-to-node capability-profile coherence.
- `approved-node` issuance now fails closed when node trust data is missing, malformed, revoked, unapproved, or enrollment-incoherent.
- issued certificate subject linkage remains durable through persisted `subjectReference` (`kind='node'`, `referenceId=<nodeId>`), with linkage eligibility derived from node-trust records.

## Story 6.2.4 certificate revocation workflow and status enforcement

Story 6.2.4 adds explicit certificate trust-withdrawal and status enforcement behavior:

- `RevokeIssuedCertificateUseCase` provides the application command to revoke an issued certificate with:
  - strict serial/actor/reason validation,
  - explicit duplicate-revocation rejection,
  - invalid-state rejection for non-issued certificate statuses,
  - persisted revocation metadata (`reason`, `revokedAt`, `revokedByActorId`, `note`) through certificate persistence boundaries.
- revocation history persistence is guaranteed via `ICertificateLifecycleEventPersistenceRepository` when revocation history is absent from a repository implementation.
- `ResolveCertificateRevocationStatusUseCase` implements `ICertificateRevocationStatusRegistry` as the canonical revocation registry seam for downstream transport consumers.
- revocation/status checks now return explicit trust status categories (`active`, `revoked`, `expired`, `superseded`, `not-yet-valid`, `not-found`) so callers can distinguish revoked certificates from expired and active certificates.

## Story 6.2.5 certificate trust evaluation helper workflows

Story 6.2.5 adds reusable certificate validity/trust evaluation behavior for downstream transport/admin/API workflows:

- `CertificateTrustEvaluationService` centralizes trust-state resolution from persisted certificate metadata and evaluation time (`asOf` or injected deterministic clock).
- trust evaluation now exposes explicit status outcomes including:
  - `active`
  - `revoked`
  - `expired`
  - `superseded`
  - `not-yet-valid`
  - `not-found`
  - `subject-inactive` (optional linked subject trust-state downgrade)
  - `invalid` (malformed/unusable certificate metadata)
- evaluation enforces boundary semantics consistently:
  - `notBefore` is inclusive
  - `notAfter` is exclusive
- `ResolveCertificateRevocationStatusUseCase` now delegates certificate status calculation to `CertificateTrustEvaluationService` so revocation registry and future consumers share one trust decision pathway.
- revocation status responses now include `usable` for callers that need a single transport-readiness boolean alongside categorical status.

## Story 6.2.6 certificate lifecycle audit recording hooks

Story 6.2.6 adds a dedicated application-level audit seam for certificate trust lifecycle operations:

- `CertificateLifecycleAuditPorts` defines the stable security audit event vocabulary and sink contract consumed by CA lifecycle use cases.
- audit dispatch is best-effort, keeping CA initialization/issuance/revocation workflows non-blocking when the audit sink is unavailable.
- sensitive audit details are sanitized/redacted before sink delivery (secret refs, key material, PEM payload fields, and similarly sensitive keys).
- initialization, issuance, and revocation workflows now emit structured lifecycle events with actor attribution where available.
- issuance now distinguishes blocked trust decisions (`certificate-issuance-blocked`) from operational failures after signing (`certificate-issuance-failed`).

### Audited lifecycle events

- `ca-initialize-started`
- `ca-initialize-succeeded`
- `ca-initialize-failed`
- `certificate-issuance-started`
- `certificate-issuance-succeeded`
- `certificate-issuance-blocked`
- `certificate-issuance-failed`
- `certificate-revocation-started`
- `certificate-revocation-succeeded`
- `certificate-revocation-failed`

## Story 6.2.7 certificate metadata listing/query seams

Story 6.2.7 adds read-side certificate visibility workflows for internal admin/API consumers:

- `ListIssuedCertificateMetadataUseCase` returns paged, operationally filtered issued-certificate metadata views with support for:
  - subject-reference type filtering (`node`, `device`, `service`)
  - linked-node filtering (`linkedNodeId`)
  - issuance-date range filtering (`issuedAfter`, `issuedBefore`)
  - lifecycle-status filtering and trust-state filtering (`active`, `revoked`, `expired`, etc.)
- `GetIssuedCertificateMetadataUseCase` returns detail metadata for a single issued certificate by serial number.
- both query use cases support optional authorization seams through `CertificateQueryAuthorizationPorts` so only trusted internal actors can read metadata.
- response DTOs and schema contracts now define stable metadata-only query payloads for downstream admin/API surfaces.

### Redaction and safety posture

- query responses intentionally exclude secret-bearing/internal material references:
  - `certificateMaterialRef`
  - `certificateChainMaterialRef`
  - `trustMaterialRef`
  - trust-material storage locators and protected secret references
- query responses return operational metadata only: serials, statuses, trust evaluation summary, subject metadata, validity, revocation metadata, and audit stamps.

## Story 6.3.1 runtime trust material export/distribution contracts

Story 6.3.1 adds explicit runtime-consumer trust retrieval contracts so server/node transport components can request scoped trust material without raw filesystem coupling:

- `ITrustMaterialDistributionPort` now includes a runtime retrieval contract (`resolveRuntimeTrustMaterialPackage`) alongside publish semantics.
- `ResolveRuntimeTrustMaterialPackageUseCase` provides the application entrypoint for:
  - input normalization/validation,
  - caller authorization via `CertificateRuntimeTrustMaterialAuthorizationHook`,
  - not-found and forbidden outcomes for runtime consumers.
- `RuntimeTrustMaterialDistributionService` (infrastructure) assembles runtime material packages from persistence + protected storage by:
  - resolving target-scoped issued certificate and CA records,
  - loading certificate/chain/bundle material through protected storage seams,
  - returning only requested runtime outputs (leaf cert, chain, trust bundle, protected references),
  - preventing subject-scope drift by requiring certificate target/reference alignment.
- runtime package responses include sanitized metadata and optional protected references (`accessRef` + redacted view) for authorized runtime components.
- private-key payloads are not exported through runtime package contracts.
- successful runtime retrieval persists a distribution event (`published`) through lifecycle-event persistence for future operational visibility.

## Story 6.3.2 certificate rotation planning and renewal eligibility services

Story 6.3.2 adds centralized renewal-planning seams so operations and future automation can reason about certificate lifecycle pressure consistently:

- `CertificateRenewalPlanningService` provides deterministic, reusable rule evaluation for:
  - issued certificate renewal states (`active`, `renewal-soon`, `renewal-required`, `expired`),
  - certificate-authority rotation states using CA validity + configured `rotateBeforeExpiryDays` policy,
  - stale lifecycle metadata detection when persisted certificate status is inconsistent with validity windows.
- `GetCertificateRenewalPlanningUseCase` composes CA and issued-certificate persistence reads with renewal policy rules and returns:
  - policy-normalized planning context (`asOf`, renewal windows),
  - CA renewal/rotation assessment with attention codes,
  - issued-certificate renewal assessments for tracked certificates,
  - summarized counts by renewal state plus attention-required indicator.

### Current rotation-policy assumptions

- issued certificate windows default to:
  - `renewal-soon`: 30 days before `notAfter`
  - `renewal-required`: 7 days before `notAfter`
- certificate authority windows default to:
  - `renewal-required`: `rotationPolicy.rotateBeforeExpiryDays`
  - `renewal-soon`: required window plus 30 lead days
- `notAfter` is treated as exclusive for active validity (at `notAfter`, state is `expired`).
- non-renewable certificate statuses (`revoked`, `superseded`) are excluded from tracked renewal counts by default, but can still be surfaced when explicitly requested.
- operator attention codes are machine-oriented and stable by intent, allowing future automation/workflows to trigger actions without UI coupling.

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
- secret metadata checks via explicit `env:<VARIABLE_NAME>` or `secret-store:<ID>` references

The secret service seam validates presence only and intentionally keeps raw key handling outside host composition. When protected storage is configured, startup checks fail closed if the protected store is unavailable.

## Story 6.1.4 protected CA material storage

Story 6.1.4 adds a concrete protected-storage pathway for CA root and signing materials:

- `ProtectedCertificateAuthorityRootMaterialStorage` persists/loads CA materials through protected interfaces only.
- `FileSystemProtectedSecretStore` stores encrypted-at-rest secret records keyed by `secret-store:` references.
- `ScopedAesGcmEncryptionService` enforces AES-256-GCM envelope encryption with key-scope support for future key hierarchy changes.
- logging/events expose only redacted secret references.

### Protected storage environment configuration

- `AI_LOOM_INTERNAL_CA_PROTECTED_SECRETS_DIRECTORY`
  - required when protected secret storage is enabled
- `AI_LOOM_INTERNAL_CA_PROTECTED_SECRETS_KEY`
  - default AES-256 key (base64 or 64-char hex)
- `AI_LOOM_INTERNAL_CA_PROTECTED_SECRETS_KEYS_BY_SCOPE`
  - optional scoped keys as comma-separated `<scope>:<key>` entries

Configuration is fail-closed: partial protected-storage configuration throws during startup validation path.

## Story 6.1.5 first-time CA initialization

Story 6.1.5 adds `InitializeCertificateAuthorityUseCase`, which is the application-layer orchestration for first-time authoritative server CA setup.

### Initialization orchestration

- calls `ICertificateAuthorityIssuerPort.initializeInternalCertificateAuthority` to generate initial root identity/signing material
- persists certificate/private-key payloads via `ICertificateAuthorityRootMaterialStorage`
- persists trust material metadata through `ITrustMaterialReferencePersistenceRepository`
- persists CA root metadata through `ICertificateAuthorityRootPersistenceRepository`

### Idempotency and guardrails

- default conflict policy is explicit rejection when an active CA already exists
- optional `return-existing` conflict policy provides safe idempotent readback of existing active CA metadata
- if authority metadata exists only in non-active states, initialization fails with migration-required semantics
- mutation operation keys are derived per persistence step to preserve replay-safe adapter behavior

### Audit/event seam

- optional structured audit hook emits:
  - `ca-initialize-started`
  - `ca-initialize-succeeded`
  - `ca-initialize-failed`
- audit payloads include redacted secret references only

### Host invocation seam

- `initializeCertificateAuthorityForFirstSetup` is exposed from `hosts/server/IdentityServerHost.ts`
- the host composition path constructs infrastructure adapters and invokes `InitializeCertificateAuthorityUseCase`, keeping initialization logic in the application layer

### Failure mode expectations

- unsafe partial states fail closed with structured diagnostics from the use case
- host startup calls `assertCertificateAuthorityStartupSafe` before bringing the server online
- diagnostics are structured for future operator/admin presentation surfaces

## Story 6.1.6 CA status and introspection query services

Story 6.1.6 adds a read-only CA introspection service for internal consumers and future admin surfaces:

- `GetCertificateAuthorityStatusIntrospectionUseCase` returns sanitized CA state and health data without exposing private key/certificate payloads, raw secret locators, or filesystem paths
- startup-state diagnostics are reused from `ResolveCertificateAuthorityStartupStateUseCase` to classify configuration/security blocking conditions
- response state vocabulary is explicit and admin-surface friendly:
  - `healthy`
  - `uninitialized`
  - `degraded`
  - `blocked`
- introspection view includes:
  - authority metadata (`certificateAuthorityId`, display and lifecycle timestamps, CA status, validity window)
  - certificate status counts and last issuance timestamp
  - computed rotation checkpoint (`recommendedRotationAt`, `configuredNextRotationDueAt`, `daysUntilRecommendedRotation`)
  - health flags for startup readiness, rotation pressure, expiring certificates, and trust-distribution failures
- shared DTO and schema contracts now include explicit CA introspection response types for downstream transport/API integration

## Story 6.2.1 certificate subject profiles and issuance policy rules

Story 6.2.1 adds typed issuance-policy modeling and pre-issuance enforcement for internal CA certificate subjects.

### Supported certificate subject classes

- `authoritative-server`
  - service subject reference with `server:` reference prefix
  - DNS SAN required and common-name-to-DNS-SAN match required
  - usages constrained to server/client/mTLS authentication semantics
- `approved-node`
  - node subject reference with `node:` reference prefix
  - URI SAN required for identity binding
  - usages constrained to node enrollment + mTLS/client pathways
  - issuance requires approved node enrollment status and non-revoked node trust lifecycle state
- `internal-service`
  - service subject reference with `service:` reference prefix
  - DNS SAN required and common-name-to-DNS-SAN match required
  - usages constrained to service identity + transport auth semantics
- `trusted-device` (reserved/future)
  - explicit typed profile exists but issuance is disabled for now to avoid speculative device-flow overbuild

### Issuance policy rationale

- profile definitions are explicit, typed, and domain-owned to keep allowed subject classes stable and auditable
- SAN/common-name rules are profile specific, preventing subject-shape drift across server/service/node trust surfaces
- validity-day ceilings are profile specific so short-lived operational identities can be enforced without widening all issuance paths
- node issuance is explicitly gated on node-trust approval and revocation state, preventing blind issuance to pending/revoked subjects
- authoritative-server and internal-service issuance paths are separated by profile kind and reference-id policy, even though both use service subject-reference kind

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

`CertificateIssuancePolicyDomain.ts` defines:

- subject profile vocabulary (`authoritative-server`, `approved-node`, `internal-service`, `trusted-device`)
- profile policy definitions (reference-kind/prefix, SAN/CN rules, allowed/required usages, validity limits)
- policy evaluation service (`evaluateCertificateIssuancePolicy`) used before certificate material issuance

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

These seams let CA workflows implement bootstrapping, issuance, lookup, revocation, and rotation without importing infrastructure into domain/application code.

Story 6.2.1 and Story 6.2.2 add `IssueCertificateForSubjectUseCase` in the application layer to:

- enforce profile policy before calling the issuer crypto port
- gate node certificate issuance on approved, non-revoked node trust state
- persist issued certificate/chain protected artifacts and trust-material metadata references before final issued-certificate metadata write
- issue bounded, redacted audit events for start/success/failure outcomes

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
- `InitializeCertificateAuthorityUseCase.test.ts`: clean initialization path, conflict policy behavior, and metadata/material sync assertions
- `GetCertificateAuthorityStatusIntrospectionUseCase.test.ts`: healthy/uninitialized/degraded/blocked state mapping, contract parse validation, and sanitization assertions
- `CertificateIssuancePolicyDomain.test.ts`: profile catalog, SAN/CN/usages/validity policy guards, and server/service path-separation assertions
- `IssueCertificateForSubjectUseCase.test.ts`: pre-issuance policy enforcement, approved-node trust prerequisites, issued material persistence, and post-signing failure compensation coverage
- `RevokeIssuedCertificateUseCase.test.ts`: explicit admin revocation flow, duplicate revocation rejection, and invalid request handling
- `ResolveCertificateRevocationStatusUseCase.test.ts`: revocation registry status resolution for active/revoked/expired/not-found cases plus deterministic clock defaulting
- `CertificateTrustEvaluationService.test.ts`: reusable trust evaluation boundaries (`notBefore` inclusive, `notAfter` exclusive), revoked-over-expiry precedence, subject-state downgrades, and invalid metadata handling
- `CertificateLifecycleAuditPorts.test.ts`: certificate lifecycle audit sanitization/redaction behavior for sink delivery
- `CertificateRenewalPlanningService.test.ts`: centralized renewal-state classification, stale-metadata detection, and CA rotation attention behavior
- `GetCertificateRenewalPlanningUseCase.test.ts`: renewal planning aggregation, tracked-state summaries, and not-found CA attention handling
- `InternalCertificateAuthorityIssuer.test.ts`: concrete root generation + signing pipeline behavior and issuance prerequisite failure coverage
- `IdentityServerHost.test.ts`: host-level first-time initialization invocation seam coverage

## Related architecture note

- Story 6.1.2 persistence schema and repository adapter details are documented in:
  - `docs/architecture/internal-ca-persistence-contracts.md`
