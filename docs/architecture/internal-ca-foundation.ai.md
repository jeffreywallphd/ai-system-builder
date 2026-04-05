# AI Companion: Internal CA Foundation

## What this slice does

- Defines a production-grade internal CA domain contract set in `src/domain/security/CertificateAuthorityDomain.ts`.
- Defines application ports for CA root persistence, certificate persistence, trust-material persistence, issuer crypto seams, and trust-bundle distribution seams.
- Adds shared DTO/schema contracts for CA and certificate records.
- Adds focused domain/port/DTO/schema tests for the new contract surface.
- Adds secure CA startup bootstrap validation seams (Story 6.1.3) for authoritative-host startup.
- Adds protected secret storage/loading seams for CA root and signing assets (Story 6.1.4).
- Adds first-time CA initialization orchestration with guarded idempotency and host invocation seam (Story 6.1.5).
- Adds CA status/health introspection query seams for internal/admin consumers (Story 6.1.6).
- Adds certificate subject profiles and pre-issuance policy enforcement seams (Story 6.2.1).
- Adds concrete CA issuance signing + protected issued-material persistence seams (Story 6.2.2).
- Adds node-trust-backed approved-node eligibility integration for certificate issuance (Story 6.2.3).
- Adds explicit certificate revocation command and revocation-status enforcement registry seams (Story 6.2.4).
- Adds reusable certificate trust/validity evaluation helper seams for consistent lifecycle status decisions (Story 6.2.5).
- Adds certificate lifecycle audit recording seams for initialization/issuance/revocation decisions and outcomes (Story 6.2.6).
- Adds issued-certificate metadata list/detail query seams for trusted admin/API consumers (Story 6.2.7).
- Adds runtime trust-material export/distribution contracts for scoped runtime consumers (Story 6.3.1).
- Adds certificate renewal eligibility and rotation planning services for pre-expiry operations readiness (Story 6.3.2).
- Adds certificate renewal/replacement execution workflow with explicit prior-certificate disposition controls and audit seams (Story 6.3.3).
- Adds authoritative server host/runtime wiring that resolves managed server trust material through CA/certificate services before transport startup (Story 6.3.4).

## Main artifacts to cite

- `src/domain/security/CertificateAuthorityDomain.ts`
- `src/domain/security/CertificateIssuancePolicyDomain.ts`
- `src/application/security/ports/ICertificateAuthorityRootPersistenceRepository.ts`
- `src/application/security/ports/IIssuedCertificatePersistenceRepository.ts`
- `src/application/security/ports/ITrustMaterialReferencePersistenceRepository.ts`
- `src/application/security/ports/ICertificateAuthorityIssuerPort.ts`
- `src/application/security/ports/ITrustMaterialDistributionPort.ts`
- `src/application/security/ports/CertificateAuthorityPorts.ts`
- `src/application/security/ports/ICertificateAuthorityBootstrapConfigurationProvider.ts`
- `src/application/security/ports/ICertificateAuthorityBootstrapSecretService.ts`
- `src/application/security/ports/ICertificateAuthorityRootMaterialStorage.ts`
- `src/application/security/ports/INodeCertificateEligibilityPort.ts`
- `src/application/security/ports/ICertificateRevocationStatusRegistry.ts`
- `src/application/security/ports/CertificateLifecycleAuditPorts.ts`
- `src/application/security/ports/CertificateQueryAuthorizationPorts.ts`
- `src/application/security/ports/CertificateRuntimeTrustMaterialAuthorizationPort.ts`
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
- `src/application/security/use-cases/RenewIssuedCertificateUseCase.ts`
- `src/application/nodes/use-cases/ResolveApprovedNodeCertificateEligibilityUseCase.ts`
- `src/infrastructure/security/InternalCertificateAuthorityBootstrapEnvironmentAdapter.ts`
- `src/infrastructure/security/encryption/ScopedAesGcmEncryptionService.ts`
- `src/infrastructure/security/secrets/FileSystemProtectedSecretStore.ts`
- `src/infrastructure/security/ca/ProtectedCertificateAuthorityRootMaterialStorage.ts`
- `src/infrastructure/security/ca/InternalCertificateAuthorityIssuer.ts`
- `src/infrastructure/security/certificates/RuntimeTrustMaterialDistributionService.ts`
- `hosts/server/IdentityServerHost.ts`
- `infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `src/application/security/tests/InitializeCertificateAuthorityUseCase.test.ts`
- `src/application/security/tests/GetCertificateAuthorityStatusIntrospectionUseCase.test.ts`
- `src/application/security/tests/IssueCertificateForSubjectUseCase.test.ts`
- `src/application/security/tests/RenewIssuedCertificateUseCase.test.ts`
- `src/application/security/tests/IssuedCertificateMetadataQueryUseCases.test.ts`
- `src/application/security/tests/ResolveRuntimeTrustMaterialPackageUseCase.test.ts`
- `src/application/nodes/tests/ResolveApprovedNodeCertificateEligibilityUseCase.test.ts`
- `src/infrastructure/security/ca/tests/InternalCertificateAuthorityIssuer.test.ts`
- `src/infrastructure/security/certificates/tests/RuntimeTrustMaterialDistributionService.test.ts`
- `hosts/server/tests/IdentityServerHost.test.ts`
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
- Infrastructure signing + root-material loading is now implemented behind `ICertificateAuthorityIssuerPort`.
- Issued certificate/chain material persistence remains behind protected storage + trust-material reference ports.
- CRL generation/distribution and automated rotation execution are still follow-on behavior.
- Host startup composes CA bootstrap checks through application use cases and adapters, not host-level raw secret/key handling.
- Startup secret metadata checks support `env:` and `secret-store:` references.
- Protected-store configuration is fail-closed when partially configured or unavailable.

## Story 6.1.3 startup-state model

- `uninitialized`: no persisted CA baseline yet
- `initialized`: CA metadata + trust metadata + secret references are coherent and ready
- `invalid`: partial/mismatched bootstrap state; fail closed
- `revoked`: CA status compromised; fail closed
- `migration-required`: retired CA or config/persistence mismatch requiring migration; fail closed

Structured diagnostics emitted by the startup use case are designed for future operator/admin surfaces.

## Story 6.1.5 first-time CA initialization behavior

- `InitializeCertificateAuthorityUseCase` orchestrates:
  - internal CA root/signing material generation via `ICertificateAuthorityIssuerPort`
  - protected root material persistence via `ICertificateAuthorityRootMaterialStorage`
  - trust metadata persistence via `ITrustMaterialReferencePersistenceRepository`
  - CA root metadata persistence via `ICertificateAuthorityRootPersistenceRepository`
- Guardrails:
  - initialization is blocked when an active CA already exists (default policy)
  - callers may opt into `return-existing` conflict policy for safe idempotent readback
  - existing non-active authority metadata triggers migration-required failure semantics
- Audit seam:
  - optional structured audit hook emits `ca-initialize-started`, `ca-initialize-succeeded`, and `ca-initialize-failed`
  - secret references are redacted in audit payloads
- Host invocation seam:
  - `initializeCertificateAuthorityForFirstSetup` composes host infrastructure and invokes the application use case
  - host call path does not bypass application-layer orchestration

## Story 6.1.6 CA status/health introspection behavior

- `GetCertificateAuthorityStatusIntrospectionUseCase` provides a read-only, sanitized CA status view for internal/admin consumers.
- It composes:
  - startup validation output from `ResolveCertificateAuthorityStartupStateUseCase`
  - CA metadata from persistence
  - issued-certificate lifecycle counts
  - trust-distribution failure indicators
  - rotation checkpoint projections
- State classification is explicit:
  - `healthy`
  - `uninitialized`
  - `degraded`
  - `blocked`
- Returned data intentionally excludes:
  - private key/certificate content
  - trust-material storage locators
  - secret reference identifiers and raw file paths
- Shared DTO/schema contracts include the introspection response shape to stabilize downstream admin API/UI integration.

## Story 6.2.1 subject profile + issuance policy behavior

- Adds explicit subject profile vocabulary in domain:
  - `authoritative-server`
  - `approved-node`
  - `internal-service`
  - `trusted-device` (reserved for future use; issuance disabled)
- Profiles define:
  - required subject-reference kind and reference-id prefix
  - allowed/required usage combinations
  - SAN/common-name policy expectations
  - profile-specific validity-day ceilings
- `IssueCertificateForSubjectUseCase` enforces policy before calling `ICertificateAuthorityIssuerPort.issueCertificateMaterial`.
- Node issuance guardrail:
  - subject reference must resolve to a persisted node
  - node must be approved
  - node must not be revoked
  - node trust state must be eligible (`pending-approval` or `trusted`)
- Server/service separation:
  - both flow through service subject-reference kind but are separated by profile kind + strict reference-id prefix (`server:` vs `service:`).
- Device trust posture:
  - typed profile exists now for forward compatibility
  - issuance is intentionally disabled until dedicated device trust flows are implemented.

## Story 6.2.2 issuance signing + persistence behavior

- `InternalCertificateAuthorityIssuer` provides concrete:
  - root CA keypair/certificate generation for initialization
  - leaf certificate signing using persisted CA root cert/key material
  - serial generation, validity-window clamping, and certificate fingerprint outputs
- `IssueCertificateForSubjectUseCase` now:
  - persists issued certificate/chain artifacts through protected storage
  - persists trust-material metadata references aligned to issued material refs
  - emits redacted issuance audit events (`started`, `succeeded`, `failed`)
  - attempts best-effort compensating certificate revocation when post-signing persistence fails

## Story 6.2.3 node approval integration for issuance eligibility

- `IssueCertificateForSubjectUseCase` now depends on `INodeCertificateEligibilityPort` for `approved-node` profile checks instead of directly querying node persistence.
- `ResolveApprovedNodeCertificateEligibilityUseCase` provides the node-trust integration seam by checking:
  - node approval status and trust state eligibility,
  - revocation state/timestamps,
  - enrollment linkage presence and enrollment approval state,
  - capability-profile validity and enrollment-to-node capability-profile consistency.
- Approved-node issuance now fails closed when node trust metadata is missing, malformed, revoked, unapproved, or enrollment-incoherent.
- Issued certificate subject linkage remains durable through `subjectReference.kind='node'` + `subjectReference.referenceId=<nodeId>` with eligibility derived from node-trust records.

## Story 6.2.4 revocation workflow + status enforcement behavior

- `RevokeIssuedCertificateUseCase` adds an explicit application-layer revocation command that:
  - validates serial/reason/actor inputs and revocation timestamps,
  - rejects duplicate revocation attempts,
  - rejects invalid revocation states (non-issued certificate status),
  - persists revocation metadata through issued-certificate persistence boundaries.
- `RevokeIssuedCertificateUseCase` also guarantees a queryable revocation-history record through lifecycle-event persistence when a repository implementation does not auto-write revocation history.
- `ResolveCertificateRevocationStatusUseCase` implements `ICertificateRevocationStatusRegistry` to provide a canonical revocation/status check seam for downstream transport and trust-enforcement consumers.
- registry responses distinguish `revoked` from `expired` and `active` while also reporting `superseded`, `not-yet-valid`, and `not-found` trust states.

## Story 6.2.5 trust evaluation helper behavior

- `CertificateTrustEvaluationService` now centralizes certificate trust-state calculation from persisted metadata + evaluation time.
- trust outcomes include:
  - `active`, `revoked`, `expired`, `superseded`, `not-yet-valid`, `not-found`
  - `subject-inactive` (optional linked-subject trust downgrade)
  - `invalid` (malformed/unusable validity metadata)
- boundary policy is explicit and shared:
  - `notBefore` inclusive
  - `notAfter` exclusive
- `ResolveCertificateRevocationStatusUseCase` now delegates trust status calculation to this helper and exposes `usable` in revocation-status responses for transport/readiness checks.

## Story 6.2.6 certificate lifecycle audit hooks behavior

- Adds `CertificateLifecycleAuditPorts` as the application-boundary security audit seam for CA lifecycle operations.
- Dispatch is best-effort so trust operations remain authoritative even when audit delivery fails.
- Audit payloads are sanitized/redacted before sink delivery to avoid leaking secret refs, PEM/key payloads, and similarly sensitive material fields.
- Initialization, issuance, and revocation use cases emit actor-attributed lifecycle events.
- Issuance now distinguishes blocked trust-policy decisions (`certificate-issuance-blocked`) from runtime failures after signing (`certificate-issuance-failed`).

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
- `certificate-renewal-started`
- `certificate-renewal-succeeded`
- `certificate-renewal-failed`

## Story 6.2.7 issued-certificate metadata query/listing behavior

- Adds `ListIssuedCertificateMetadataUseCase` for paged issued-certificate metadata listing with operational filters:
  - subject-reference kind
  - linked node id
  - issuance date range
  - certificate lifecycle status
  - evaluated trust state
- Adds `GetIssuedCertificateMetadataUseCase` for single-certificate metadata detail by serial.
- Adds optional `CertificateQueryAuthorizationPorts` hook seam so trusted admin/API consumers can be authorized before query execution.
- Adds stable shared DTO/schema contracts for list/detail metadata payloads used by future API/admin surfaces.

### Redaction posture for query outputs

- Excludes secret-bearing/internal references and unsafe internals from responses, including:
  - `certificateMaterialRef`
  - `certificateChainMaterialRef`
  - `trustMaterialRef`
  - trust-material storage locators / secret refs
- Includes only operational trust metadata needed for visibility and decisions (subject/status/validity/revocation/trust summary).

## Story 6.3.1 runtime trust-material export/distribution behavior

- `ITrustMaterialDistributionPort` now provides runtime retrieval contracts (`resolveRuntimeTrustMaterialPackage`) for server/node/device/service runtime consumers.
- `ResolveRuntimeTrustMaterialPackageUseCase` is the application boundary for:
  - request normalization and validation,
  - caller authorization via `CertificateRuntimeTrustMaterialAuthorizationHook`,
  - deterministic `invalid-request`, `forbidden`, and `not-found` outcomes.
- `RuntimeTrustMaterialDistributionService` implements concrete runtime package assembly by:
  - loading scoped issued-certificate + CA metadata,
  - enforcing target-scope alignment (subject kind/reference/workspace),
  - resolving trust material metadata references,
  - loading certificate/chain/root material through protected storage seams,
  - returning only requested package outputs (leaf cert, chain, trust bundle, protected references).
- private key plaintext is intentionally excluded from runtime package outputs.
- retrieval success is tracked through persisted `certificate_distribution_events` (`published`) for operational follow-up.

## Story 6.3.2 rotation planning + renewal eligibility behavior

- `CertificateRenewalPlanningService` centralizes renewal-state evaluation logic for both CA and issued certificates.
- issued-certificate renewal states are explicit and stable for downstream automation:
  - `active`
  - `renewal-soon`
  - `renewal-required`
  - `expired`
- CA rotation-state evaluation uses:
  - CA `validity.notAfter`
  - `rotationPolicy.rotateBeforeExpiryDays` as required checkpoint baseline
  - configurable lead days for `renewal-soon` posture ahead of required checkpoint
- stale-state detection identifies certificate metadata drift when persisted status does not match validity-window reality (for example, issued-but-already-expired).
- `GetCertificateRenewalPlanningUseCase` composes persistence reads + renewal policy rules and returns:
  - normalized policy windows (`asOf`, issued renewal windows, CA lead window),
  - CA renewal/rotation assessment,
  - issued-certificate renewal assessments and aggregate counts,
  - machine-readable operator attention items (without UI-coupled presentation logic).

### Current policy defaults and assumptions

- issued certificate defaults:
  - renewal-soon window: 30 days before expiry
  - renewal-required window: 7 days before expiry
- CA defaults:
  - renewal-required checkpoint: `rotationPolicy.rotateBeforeExpiryDays`
  - renewal-soon checkpoint: required checkpoint + 30 lead days
- `notAfter` boundary is exclusive for active validity; evaluation at `notAfter` yields `expired`.
- non-renewable issued statuses (`revoked`, `superseded`) are excluded from tracked renewal counts by default.
- attention outputs are code-first and automation-friendly so future jobs/controllers can trigger remediation without redesign.

## Story 6.3.3 renewal/replacement execution workflow behavior

- `RenewIssuedCertificateUseCase` adds a production-ready manual/service-triggered renewal command that:
  - validates request shape (serial, actor, material refs, key parameters),
  - loads the previous issued certificate and rejects non-renewable lifecycle statuses (`revoked`, `superseded`),
  - derives the renewal profile from existing subject linkage and rejects unsupported mappings.
- replacement issuance is delegated to `IssueCertificateForSubjectUseCase`, preserving centralized policy checks, CA validity enforcement, approved-node eligibility enforcement, protected material persistence, and issuance auditing.
- previous certificate disposition is now explicit:
  - `supersede` (default) marks the prior cert as `superseded` with `supersededBySerialNumber` linkage.
  - `preserve` leaves prior status untouched for overlap/grace operation windows.
- overlap semantics are fail-closed:
  - `gracePeriodDays > 0` is valid only with `previousCertificateDisposition='preserve'`.
  - invalid combinations are rejected.
- renewal lifecycle audit outcomes are emitted via `CertificateLifecycleAuditPorts`:
  - `certificate-renewal-started`
  - `certificate-renewal-succeeded`
  - `certificate-renewal-failed`

## Story 6.3.4 authoritative server runtime wiring behavior

- `startIdentityServerHost` now supports managed TLS bootstrap posture (`AI_LOOM_INTERNAL_CA_SERVER_MANAGED_TLS_ENABLED=true`) so authoritative transport startup depends on managed certificate services.
- managed runtime material resolution is composed through:
  - `ResolveRuntimeTrustMaterialPackageUseCase` + `RuntimeTrustMaterialDistributionService` for server-scoped trust package retrieval,
  - `ResolveCertificateRevocationStatusUseCase` for certificate trust-state enforcement,
  - `ProtectedCertificateAuthorityRootMaterialStorage` for protected private-key material loading.
- startup fails closed when managed runtime trust materials are missing or unsafe:
  - runtime trust package not found,
  - package missing server serial or leaf certificate payload,
  - resolved server certificate trust status is not usable (revoked/expired/not valid),
  - configured TLS private-key trust material ref missing or wrong kind.
- `IdentityHttpServer` now supports injected server factory composition so host runtime can start HTTPS using managed certificate material without changing transport handler logic.

## Coverage in this slice

- Domain invariants and lifecycle transitions: `src/domain/security/tests/CertificateAuthorityDomain.test.ts`
- Subject profile policy validation coverage: `src/domain/security/tests/CertificateIssuancePolicyDomain.test.ts`
- Port contract assumptions: `src/application/security/tests/CertificateAuthorityPortsContracts.test.ts`
- Bootstrap startup state coverage: `src/application/security/tests/ResolveCertificateAuthorityStartupStateUseCase.test.ts`
- Environment adapter coverage: `src/infrastructure/security/tests/InternalCertificateAuthorityBootstrapEnvironmentAdapter.test.ts`
- Host fail-closed startup coverage (including managed TLS runtime trust startup outcomes): `hosts/server/tests/IdentityServerHost.test.ts`
- DTO helper coverage: `src/shared/dto/security/tests/CertificateAuthorityDtos.test.ts`
- schema parse/validation behavior: `src/shared/schemas/security/tests/CertificateAuthoritySchemaContracts.test.ts`
- protected-secret store coverage: `src/infrastructure/security/secrets/tests/FileSystemProtectedSecretStore.test.ts`
- protected CA material save/load coverage: `src/infrastructure/security/ca/tests/ProtectedCertificateAuthorityRootMaterialStorage.test.ts`
- first-time CA initialization coverage: `src/application/security/tests/InitializeCertificateAuthorityUseCase.test.ts`
- CA introspection state/health/sanitization coverage: `src/application/security/tests/GetCertificateAuthorityStatusIntrospectionUseCase.test.ts`
- issuance policy + issued-material persistence/failure compensation coverage: `src/application/security/tests/IssueCertificateForSubjectUseCase.test.ts`
- revocation command behavior (admin action / duplicate / invalid request): `src/application/security/tests/RevokeIssuedCertificateUseCase.test.ts`
- revocation registry status enforcement behavior: `src/application/security/tests/ResolveCertificateRevocationStatusUseCase.test.ts`
- trust evaluation helper and boundary coverage: `src/application/security/tests/CertificateTrustEvaluationService.test.ts`
- lifecycle audit sanitization behavior: `src/application/security/tests/CertificateLifecycleAuditPorts.test.ts`
- renewal state classification and stale metadata detection coverage: `src/application/security/tests/CertificateRenewalPlanningService.test.ts`
- renewal planning aggregation/attention coverage: `src/application/security/tests/GetCertificateRenewalPlanningUseCase.test.ts`
- renewal/replacement success + failure coverage: `src/application/security/tests/RenewIssuedCertificateUseCase.test.ts`
- concrete issuer signing pipeline coverage: `src/infrastructure/security/ca/tests/InternalCertificateAuthorityIssuer.test.ts`
- host initialization seam coverage: `hosts/server/tests/IdentityServerHost.test.ts`

## Follow-on note

- Story 6.1.2 adds persistence schema + adapter details in:
  - `docs/architecture/internal-ca-persistence-contracts.ai.md`
