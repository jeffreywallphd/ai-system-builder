# AI Companion: Deployment Profile Policy Admin Observability, Redaction, and Failure Handling

## Purpose

Story 20.3.5 adds structured and redacted policy-administration observability so production operators can diagnose read/write/validation/bootstrap/admin-surface failures without exposing unsafe policy payloads.

## Human doc

- `docs/architecture/deployment-profile-policy-admin-observability-redaction-and-failure-handling.md`

## Canonical files

- `src/application/policy-administration/ports/DeploymentPolicyAdministrationObservabilityPorts.ts`
- `src/application/policy-administration/use-cases/ReadDeploymentPolicyAdministrationUseCase.ts`
- `src/application/policy-administration/use-cases/DeploymentPolicyAdministrationAuthoritativeUpdateUseCase.ts`
- `src/application/configuration/DeploymentPolicyBootstrapResolutionService.ts`
- `src/infrastructure/api/deployment/DeploymentPolicyReadBackendApi.ts`
- `src/infrastructure/api/deployment/DeploymentPolicyWriteBackendApi.ts`
- `src/infrastructure/api/deployment/PlatformDeploymentPolicyAdministrationObservabilityPort.ts`
- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `src/hosts/server/IdentityServerHost.ts`

## Summary

- Policy admin emits structured operation/outcome/severity diagnostics across bootstrap/read/write/admin-surface boundaries.
- Correlation IDs are propagated from host request headers and generated for write flows when absent.
- Observability redaction removes unsafe value/payload/path/token-like content before sink publication.
- Validation and bootstrap failures are explicit diagnostic events, separate from user-facing API error envelopes.
- Platform observability adapter logs sanitized diagnostics and emits best-effort metric counters from the same event stream.
