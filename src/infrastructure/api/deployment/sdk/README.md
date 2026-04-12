# Deployment SDK (Reference, Minimal)

This module provides a minimal TypeScript deployment SDK that is thin over the existing deployment API surface.

## Public contract

Use `PublicDeploymentSdkContract.ts` for transport-friendly request/response/error DTOs:

- `DeploymentSdkStartDeploymentRequest` / `DeploymentSdkStartDeploymentResponse`
- `DeploymentSdkDeploymentStatusRequest` / `DeploymentSdkDeploymentStatusResponse`
- `DeploymentSdkListDeploymentsRequest` / `DeploymentSdkListDeploymentsResponse`
- `DeploymentSdkGetActiveDeploymentRequest` / `DeploymentSdkGetActiveDeploymentResponse`
- `DeploymentSdkRollbackRequest` / `DeploymentSdkRollbackResponse`
- `DeploymentSdkHealthRequest` / `DeploymentSdkHealthResponse`
- `DeploymentSdkResponse<T>` and `DeploymentSdkError`

## Reference client

`DeploymentClient` composes a `DeploymentSdkTransport` and adds optional default authentication/caller context.

The in-repo reference transport is `DeploymentApiSdkTransport`, which adapts to `DeploymentBackendApi` without embedding deployment business logic.
