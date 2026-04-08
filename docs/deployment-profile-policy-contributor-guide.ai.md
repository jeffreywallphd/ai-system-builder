# AI Companion: Deployment Profile Policy Contributor Guide

## Purpose

Implementation workflow for adding policy families, preset behavior, and feature-facing policy evaluation APIs while preserving deployment-policy architecture boundaries.

## Human doc

- `docs/deployment-profile-policy-contributor-guide.md`

## Canonical workflow

- Keep taxonomy/preset definitions in `src/domain/deployment/DeploymentProfilePolicyAdministrationDomain.ts`.
- Keep effective-value resolution and override validation in `src/application/deployment/*` contracts/services.
- Keep durable policy persistence seams in `src/application/deployment/ports/*` and `src/infrastructure/persistence/deployment/*`.
- Keep integrated startup/read/write/audit workflow expectations aligned with `docs/architecture/deployment-profile-policy-persistence-api-integration-baseline.md`.
- Keep feature-facing decisions in `src/application/policy-administration/*` evaluation interfaces/services.
- Keep authoritative policy mutation validation/permission enforcement in `src/application/policy-administration/use-cases/DeploymentPolicyAdministrationAuthoritativeUpdateUseCase.ts`.
- Keep authoritative write transport/backend wiring in `src/infrastructure/api/deployment/DeploymentPolicyWriteBackendApi.ts` and `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`.
- Keep payload contracts and schema validation in `src/shared/contracts|dto|schemas/deployment/*`.
- Keep docs/tests aligned for `.md` and `.ai.md` surfaces.

## Guardrails

- Use `IDeployment*PolicyEvaluationPort` interfaces for feature policy decisions.
- Keep write-time policy mutation checks centralized in the policy-administration use case layer.
- Keep startup policy resolution in `DeploymentPolicyBootstrapResolutionService.ts`; avoid route-level fallback policy branching.
- Keep preset/profile behavior data-driven from canonical definitions.
- Do not put profile-specific branching into UI, transport handlers, or backend adapters.

## Story 20.2.3 reference integrations

- `CreateWorkspaceUseCase` consumes `IDeploymentAuthorizationPolicyEvaluationPort` for policy-driven default visibility.
- `ValidateRunSubmissionUseCase` consumes `IDeploymentSchedulingPolicyEvaluationPort` for approval prerequisite enforcement.
- Both integrations resolve policy context through explicit resolver seams, keeping policy resolution at application boundaries.

Intentionally deferred families in this story:

- storage-governance runtime default synthesis,
- security-governance transport/credential enforcement,
- audit-governance runtime export/redaction/retention enforcement,
- admin-controls delegated-admin runtime gates,
- broader scheduling rule overlays.
