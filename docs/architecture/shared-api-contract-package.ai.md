# AI Companion: Shared API Contract Package

## Purpose

- Canonical shared API contract layer for Story 14.1.2.
- Ensure desktop and thin clients consume the same typed server transport contracts.

## Added shared contract homes

- `src/shared/contracts/api/SharedApiContractPrimitives.ts`
- `src/shared/contracts/identity/IdentityTransportContracts.ts`
- `src/shared/contracts/workspaces/WorkspaceTransportContracts.ts`
- `src/shared/contracts/runtime/SystemRuntimeTransportContracts.ts`
- `src/shared/contracts/deployment/DeploymentTransportContracts.ts`

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
