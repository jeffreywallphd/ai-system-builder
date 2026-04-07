# AI Companion: Shared API Contract Package

## Purpose

- Canonical shared API contract layer for Story 14.1.2.
- Ensure desktop and thin clients consume the same typed server transport contracts.
- Extend convergence with Story 14.1.3 shared error semantics.

## Added shared contract homes

- `src/shared/contracts/api/SharedApiContractPrimitives.ts`
- `src/shared/contracts/identity/IdentityTransportContracts.ts`
- `src/shared/contracts/workspaces/WorkspaceTransportContracts.ts`
- `src/shared/contracts/runtime/SystemRuntimeTransportContracts.ts`
- `src/shared/contracts/deployment/DeploymentTransportContracts.ts`

## Story 14.1.3 error-semantic additions

- Shared API primitives now include retryable operational failure code support (`temporarily-unavailable`) and standardized error metadata fields:
  - `sharedCode`
  - `domainCode`
  - `retryable`
  - `userMessage`
- Server transport now applies centralized error translation for HTTP and websocket-adjacent denials so converged routes emit one consistent error surface.
- Client-visible error messages are sanitized to prevent leaking raw paths, credentials, token/secret values, or low-level internal failure details.
- Unknown converged routes now return canonical `not-found` error semantics.

## Added schema homes

- `src/shared/schemas/identity/IdentityTransportSchemaContracts.ts`
- `src/shared/schemas/workspaces/WorkspaceTransportSchemaContracts.ts`
- `src/shared/schemas/runtime/SystemRuntimeTransportSchemaContracts.ts`
- `src/shared/schemas/deployment/DeploymentTransportSchemaContracts.ts`

## Converged initial domains covered

- Sessions and trusted-device flows (identity)
- Workspace administration and invitation flows
- Runtime run lifecycle and queue visibility
- Deployment lifecycle and health operations
- Existing converged contracts retained for assets and nodes

## Integration points updated

- Client imports now target shared contracts for identity and workspaces.
- Server backend API imports now target shared contracts for identity and workspaces.
- Legacy infrastructure SDK contracts are marked as compatibility shims for migration.

## Canonical doc

- `docs/architecture/shared-api-contract-package.md`
