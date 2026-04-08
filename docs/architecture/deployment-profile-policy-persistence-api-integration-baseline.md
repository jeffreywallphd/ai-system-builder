# Deployment Profile Policy Persistence, Authoritative APIs, and Integration Baseline

## Story alignment

- Feature 20: Deployment Profiles and Policy Administration
- Epic 20.2: Build Persistent Policy Storage, Evaluation Integration, and Authoritative Administration APIs
- Story 20.2.8: Document policy persistence, API workflows, and integration expectations

## Purpose

Provide one implementation-oriented baseline for how authoritative deployment-policy administration works end to end:

1. server startup/bootstrap policy resolution,
2. authoritative read and write API workflows,
3. write-time validation and persistence behavior,
4. governance audit/operational event capture,
5. expected dependent-feature consumption seams.

This document is additive to the focused architecture notes for persistence, effective-resolution, read APIs, write APIs, startup bootstrap, evaluation seams, and governance hooks.

## Canonical files and seams

- Domain configuration registry and taxonomy:
  - `src/domain/deployment/DeploymentProfilePolicyAdministrationDomain.ts`
- Effective-state resolution and override validation:
  - `src/application/deployment/DeploymentPolicyEffectiveResolutionService.ts`
  - `src/application/deployment/DeploymentPolicyAdministrationContracts.ts`
- Authoritative mutation and query use cases:
  - `src/application/policy-administration/use-cases/DeploymentPolicyAdministrationAuthoritativeUpdateUseCase.ts`
  - `src/application/policy-administration/use-cases/ReadDeploymentPolicyAdministrationUseCase.ts`
- Runtime policy evaluation seams consumed by features:
  - `src/application/policy-administration/DeploymentPolicyEvaluationPorts.ts`
  - `src/application/policy-administration/DeploymentPolicyEvaluationService.ts`
  - `src/application/policy-administration/CanonicalDeploymentPolicySnapshotResolver.ts`
- Persistence repository + SQLite adapter:
  - `src/application/deployment/ports/IDeploymentPolicyPersistenceRepository.ts`
  - `src/infrastructure/persistence/deployment/SqliteDeploymentPolicyPersistenceAdapter.ts`
  - `src/infrastructure/persistence/deployment/SqliteDeploymentPolicyPersistenceMigrations.ts`
  - `src/infrastructure/persistence/deployment/DeploymentPolicyPersistenceMapper.ts`
- Authoritative API contracts and adapters:
  - `src/shared/contracts/deployment/DeploymentPolicyReadContracts.ts`
  - `src/shared/contracts/deployment/DeploymentPolicyWriteContracts.ts`
  - `src/shared/schemas/deployment/DeploymentPolicyReadSchemaContracts.ts`
  - `src/shared/schemas/deployment/DeploymentPolicyWriteSchemaContracts.ts`
  - `src/infrastructure/api/deployment/DeploymentPolicyReadBackendApi.ts`
  - `src/infrastructure/api/deployment/DeploymentPolicyWriteBackendApi.ts`
  - `src/infrastructure/transport/http-server/authoritative-route-families/DeploymentAuthoritativeApiRoutes.ts`
- Startup/bootstrap composition:
  - `src/application/configuration/DeploymentPolicyBootstrapResolutionService.ts`
  - `src/hosts/server/AuthoritativeServerCompositionRoot.ts`
  - `src/hosts/server/IdentityServerHost.ts`
- Governance-event and audit integration:
  - `src/application/policy-administration/ports/DeploymentPolicyGovernanceEventPorts.ts`
  - `src/infrastructure/api/deployment/PlatformDeploymentPolicyGovernanceEventSink.ts`
  - `src/infrastructure/audit/AuthoritativeDeploymentPolicyGovernanceEventSink.ts`
  - `src/infrastructure/audit/AuditFanoutPublishers.ts`

## Authoritative workflow baseline

### 1. Server bootstrap and startup policy state

`DeploymentPolicyBootstrapResolutionService` resolves policy state before runtime feature registration:

1. resolve active profile selection for deployment-policy scope (`deployment-policy-scope`, default scope id `platform:default`),
2. apply deterministic `home` fallback when no persisted selection exists,
3. load persisted override records for resolved active profile,
4. resolve effective snapshot through canonical resolver seams,
5. fail startup with `invalid-persisted-state` when persisted state is invalid,
6. provide evaluation context + evaluation service for downstream host wiring.

### 2. Authoritative reads

`ReadDeploymentPolicyAdministrationUseCase` and `DeploymentPolicyReadBackendApi` provide `GET /api/v1/deployment/policy/state`:

1. schema-parse request using shared read schema contracts,
2. resolve normalized scope and active profile source (`persisted-selection` or `default-fallback`),
3. resolve effective snapshot/validation from canonical resolver seams,
4. optionally include catalog, override records, and effective metadata,
5. return typed shared read contract payload.

Reads are inspection workflows and do not mutate policy state.

### 3. Authoritative writes

`DeploymentPolicyAdministrationAuthoritativeUpdateUseCase` and `DeploymentPolicyWriteBackendApi` handle:

- `POST /api/v1/deployment/policy/active-profile`
- `POST /api/v1/deployment/policy/overrides`

Write workflow ordering:

1. schema-parse request using shared write schema contracts,
2. normalize scope and operation input shape,
3. enforce permission gates (`selectActiveProfile`, `manageOverrides`, `manageRuntimeAdminOverrides`),
4. validate operations against canonical taxonomy/control modes/value rules,
5. enforce safe remove semantics and ticket-reference requirement policy,
6. persist through `IDeploymentPolicyPersistenceRepository` only,
7. resolve/return canonical post-write snapshot + validation,
8. best-effort publish governance events after persistence success.

## Persistence and validation guarantees

Persistence model guarantees:

- active profile selection per scope,
- typed override values (`value_type`, `value_string`, `value_number`, `value_boolean`),
- override history with actor/reason/ticket/correlation provenance,
- effective metadata snapshots with validation results,
- replay-safe mutation behavior using normalized operation keys.

Validation guarantees:

- canonical family/setting existence checks,
- control-mode enforcement (`profile-fixed` cannot be overridden),
- structured issue output from override validation,
- optimistic conflict enforcement through expected revision behavior,
- explicit invalid-request/forbidden/conflict/internal API error mapping.

## Audit and operational governance integration

Write-side governance integration is explicit and separated from feature logic:

1. update use case emits deployment-policy governance events (`deployment-policy-active-profile-changed`, `deployment-policy-overrides-mutated`) on `audit` and `operational` channels,
2. platform sink maps events into platform-level governance telemetry,
3. authoritative sink maps `audit` channel events into canonical audit recording service payloads,
4. event payloads remain redacted/safe and avoid raw override value capture in first production scope.

## Expected dependent-feature consumption pattern

Dependent features should consume deployment-policy decisions through `IDeployment*PolicyEvaluationPort` interfaces and policy context resolvers at application boundaries.

Expected flow:

1. resolve policy evaluation context (profile + overrides) from startup-provided resolver seam,
2. call typed evaluation interfaces (`evaluateAuthorizationPolicy`, `evaluateStoragePolicy`, `evaluateSchedulingPolicy`, `evaluateSecurityPolicy`, `evaluateAuditAndAdminPolicy`),
3. map returned typed decisions into feature behavior,
4. avoid direct reads of raw preset catalog, persistence records, or ad hoc profile branching.

Current production examples:

- `src/application/workspaces/use-cases/CreateWorkspaceUseCase.ts`
- `src/application/runs/use-cases/ValidateRunSubmissionUseCase.ts`

## Intentionally deferred integrations and current limits

Intentionally deferred policy-driven integrations remain explicit:

- storage-governance default payload synthesis beyond current feature seams,
- security-governance transport/credential runtime controls outside existing dedicated security policy pathways,
- audit-governance query/export runtime controls,
- delegated admin-controls enforcement beyond policy-administration mutation paths,
- broader scheduling profile overlays beyond current run-submission approval prerequisites.

Current limits:

- first-scope policy-governance events include safe summaries and do not persist raw override values,
- supported mutation scope kind remains `deployment-policy-scope`,
- startup bootstrap currently resolves one canonical scope by default (`platform:default`) unless host wiring overrides scope configuration.

## Related focused architecture notes

- `docs/architecture/deployment-profile-policy-persistence-and-repositories.md`
- `docs/architecture/deployment-profile-policy-effective-resolution-and-overrides.md`
- `docs/architecture/deployment-profile-policy-authoritative-read-apis.md`
- `docs/architecture/deployment-profile-policy-authoritative-write-apis.md`
- `docs/architecture/deployment-profile-policy-startup-bootstrap-resolution.md`
- `docs/architecture/deployment-profile-policy-audit-operational-governance-hooks.md`
- `docs/architecture/deployment-profile-policy-evaluation-seams.md`
