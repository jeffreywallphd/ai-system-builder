# Deployment Profile Policy Admin Observability, Redaction, and Failure Handling

## Purpose

Story 20.3.5 adds production-grade observability for deployment-profile policy administration so reads, writes, validation failures, bootstrap failures, and admin-surface errors are diagnosable without leaking sensitive configuration payloads.

## Canonical implementation files

- `src/application/policy-administration/ports/DeploymentPolicyAdministrationObservabilityPorts.ts`
- `src/application/policy-administration/use-cases/ReadDeploymentPolicyAdministrationUseCase.ts`
- `src/application/policy-administration/use-cases/DeploymentPolicyAdministrationAuthoritativeUpdateUseCase.ts`
- `src/application/configuration/DeploymentPolicyBootstrapResolutionService.ts`
- `src/infrastructure/api/deployment/DeploymentPolicyReadBackendApi.ts`
- `src/infrastructure/api/deployment/DeploymentPolicyWriteBackendApi.ts`
- `src/infrastructure/api/deployment/PlatformDeploymentPolicyAdministrationObservabilityPort.ts`
- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `src/hosts/server/IdentityServerHost.ts`

## Observability model

- Deployment policy admin flows now emit structured observability events through a dedicated application port.
- Event operation categories are explicit:
  - `bootstrap`
  - `read`
  - `write`
  - `admin-surface`
- Event outcomes are explicit:
  - `success`
  - `rejected`
  - `failure`
- Correlation behavior:
  - write flows carry request correlation IDs when provided,
  - write flows generate fallback correlation IDs when missing,
  - host routes propagate request correlation IDs from `x-correlation-id`.

## Redaction and safe diagnostics

- Observability payloads are sanitized before sink publication.
- Sensitive keys and nested fragments are redacted (`[REDACTED]`) for:
  - raw values,
  - payload/body/internal diagnostic fragments,
  - filesystem path and token-like strings.
- Update diagnostics publish safe counters and coded metadata instead of raw override values.
- User-facing API validation responses remain path/code/message-oriented while operational diagnostics carry separate structured phases/counters.

## Explicit failure handling

- Policy update use case now emits explicit failure diagnostics for:
  - request shape/scope rejection,
  - permission denial,
  - validation failure,
  - persistence/load/save failures.
- Bootstrap resolution now emits explicit failure diagnostics for:
  - invalid persisted policy state,
  - non-validation bootstrap errors.
- Read/write backend APIs emit admin-surface diagnostics for:
  - request validation rejection,
  - permission rejection,
  - internal/use-case execution failures.
- Observability publication remains best-effort and non-blocking.

## Metrics posture

- Update-attempt and result counters are carried on structured events.
- Platform adapter emits aggregate + counter metrics (best-effort) from the same sanitized event payload.

## Boundaries

- Core policy evaluation and mutation logic remains in domain/application policy components.
- Observability responsibilities stay in:
  - dedicated ports and helpers at application boundaries,
  - infrastructure observability adapters,
  - host routing/context propagation seams.
