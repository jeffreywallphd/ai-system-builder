# Deployment Profile and Policy Administration Regression Hardening Baseline

## Story alignment

- Feature 20: Deployment Profiles and Policy Administration
- Epic 20.3: Deliver Policy Administration Surfaces, Safe Admin Controls, and Production Hardening
- Story 20.3.7: Execute end-to-end deployment-profile and policy-administration regression hardening

## Purpose

Capture the final hardening baseline for the implemented deployment-profile and policy-administration stack across:

1. preset definitions and effective-value resolution invariants,
2. persistence and startup/bootstrap behavior,
3. authoritative policy read/write APIs and schema contracts,
4. dependent-feature policy evaluation seams,
5. admin authorization boundaries, governance audit hooks, and observability behavior.

## Canonical implementation and regression files

- Domain + effective-resolution seams:
  - `src/domain/deployment/DeploymentProfilePolicyAdministrationDomain.ts`
  - `src/application/deployment/DeploymentPolicyAdministrationContracts.ts`
  - `src/application/deployment/DeploymentPolicyEffectiveResolutionService.ts`
- Persistence + bootstrap:
  - `src/application/deployment/ports/IDeploymentPolicyPersistenceRepository.ts`
  - `src/infrastructure/persistence/deployment/SqliteDeploymentPolicyPersistenceAdapter.ts`
  - `src/application/configuration/DeploymentPolicyBootstrapResolutionService.ts`
- Policy-admin authoritative APIs:
  - `src/application/policy-administration/use-cases/DeploymentPolicyAdministrationAuthoritativeUpdateUseCase.ts`
  - `src/application/policy-administration/use-cases/ReadDeploymentPolicyAdministrationUseCase.ts`
  - `src/infrastructure/api/deployment/DeploymentPolicyReadBackendApi.ts`
  - `src/infrastructure/api/deployment/DeploymentPolicyWriteBackendApi.ts`
- Dependent-feature policy consumption seams:
  - `src/application/policy-administration/DeploymentPolicyEvaluationPorts.ts`
  - `src/application/policy-administration/DeploymentPolicyEvaluationService.ts`
  - `src/application/workspaces/use-cases/CreateWorkspaceUseCase.ts`
  - `src/application/runs/use-cases/ValidateRunSubmissionUseCase.ts`
- Regression hardening integration coverage:
  - `src/application/policy-administration/tests/DeploymentPolicyAdministrationRegressionLifecycle.integration.test.ts`

## Hardened invariants verified by regression coverage

1. One-architecture profile support stays explicit (`home`, `classroom`, `organization`) without route/UI profile branching.
2. Active profile fallback remains explicit seam configuration (`fallbackProfileId`/`defaultProfileId`) instead of hidden literals.
3. Effective-value provenance remains explicit (`profile-preset`, `policy-default`, `admin-state`) before and after override mutation/removal.
4. Override mutation provenance cannot spoof request actor through write payloads; authoritative actor identity is used.
5. No raw-config bypasses are required for feature behavior: dependent behavior consumes evaluation seams resolved from canonical snapshots.
6. Runtime-admin policy mutation requires dedicated runtime-admin permission and rejects unauthorized writes without persistence mutation.
7. Governance hooks emit audit and operational channels with safe summary payloads (no raw override value capture).
8. Observability captures bootstrap, read, write success, and permission rejection surfaces.

## Cross-layer contract drift checks

- Shared read/write deployment-policy schemas remain authoritative for API request and response parsing.
- Read/write backend adapters map use-case outcomes to stable shared API envelopes (`invalid-request`, `forbidden`, `conflict`, `internal`).
- Admin UI services continue consuming shared read/write contracts instead of ad hoc payload shapes.

## Final implemented scope and explicit deferred edges

Implemented in this final hardening baseline:

- profile selection + override lifecycle hardening through authoritative write/read and persistence round-trips,
- explicit provenance and control-mode safe mutation semantics,
- bootstrap-to-evaluation seam continuity for runtime consumption,
- permission-safe mutation boundaries, governance event publication, and structured observability behavior.

Still explicitly deferred in this slice:

- storage-governance default payload synthesis beyond existing policy evaluation pathways,
- security-governance transport/credential runtime enforcement outside current security feature seams,
- audit-governance export/query runtime control expansion,
- admin-controls delegated-admin runtime gate expansion outside current policy-administration mutation boundaries,
- broader scheduling overlays beyond current run-submission approval prerequisite integration.
