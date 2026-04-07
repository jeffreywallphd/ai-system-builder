# Shared API Contract Package

## Story alignment

- Feature: 14, Desktop and Thin-Client Unified API Surface
- Epic: 14.1, Establish Shared API Contracts and Access Foundations
- Story: 14.1.2, Create the shared API contract and schema package for multi-surface clients
- Story: 14.1.3, Standardize API error, permission-denied, and not-found response semantics

## Purpose

Provide a canonical shared transport package so desktop, browser, and responsive clients depend on one authoritative request/response contract surface for protected operations.

## Package layout

- `src/shared/contracts/api/SharedApiContractPrimitives.ts`
  - Canonical identifier envelopes, pagination/filtering primitives, mutation result envelopes, and standardized error semantics.
- `src/shared/contracts/identity/IdentityTransportContracts.ts`
  - Session, trusted-device, and identity admin-lite transport route catalog and typed operation contracts.
- `src/shared/contracts/workspaces/WorkspaceTransportContracts.ts`
  - Workspace administration and invitation transport contracts.
- `src/shared/contracts/runtime/SystemRuntimeTransportContracts.ts`
  - Runtime run lifecycle and queue transport contracts.
- `src/shared/contracts/deployment/DeploymentTransportContracts.ts`
  - Deployment lifecycle transport contracts.
- `src/shared/schemas/identity/IdentityTransportSchemaContracts.ts`
- `src/shared/schemas/workspaces/WorkspaceTransportSchemaContracts.ts`
- `src/shared/schemas/runtime/SystemRuntimeTransportSchemaContracts.ts`
- `src/shared/schemas/deployment/DeploymentTransportSchemaContracts.ts`
  - Schema-backed payload parsers and validation error shaping for shared contracts.

## Usage guidance

1. Prefer imports from `src/shared/contracts/*` in client and backend API adapters.
2. Use schema parser helpers from `src/shared/schemas/*` at transport boundaries (HTTP/WSS handlers, SDK ingest points, or adapter input normalization).
3. Keep UI-specific state out of shared transport contracts; only include server-authoritative DTOs and envelopes.
4. Treat infrastructure `Public*ApiContract.ts` modules as compatibility shims during migration.

## Error semantics standardization (Story 14.1.3)

- Shared error primitives now define:
  - canonical shared error code taxonomy including retryable operational failure classification (`temporarily-unavailable`),
  - stable machine-readable metadata fields for transport errors (`sharedCode`, `domainCode`, `retryable`),
  - user-safe error message field (`userMessage`) for client rendering without leaking internals.
- Authoritative HTTP and websocket-adjacent transport now applies one server-side translation pass before writing client-visible error payloads:
  - maps domain-specific codes into shared semantics while preserving domain code for compatibility,
  - emits shared classification metadata consistently across converged endpoints,
  - sanitizes sensitive/internal message content (paths, credentials, token/secrets, stack/db internals) from client-visible error text.
- Unknown API routes are now emitted with canonical not-found semantics (`404` + `not-found`) instead of endpoint-specific invalid-request fallbacks.

## Current integration points

- Client-side imports:
  - `src/ui/shared/identity/IdentityAuthClient.ts`
  - `src/ui/shared/workspaces/WorkspaceAdministrationClient.ts`
- Server-side imports:
  - `src/infrastructure/api/identity/IdentityAuthBackendApi.ts`
  - `src/infrastructure/api/workspaces/WorkspaceAdministrationBackendApi.ts`

## Migration notes

- Existing `src/infrastructure/api/*/sdk/Public*Contract.ts` files include migration notes and remain source-compatible for current consumers.
- New contract additions for protected domains should land in `src/shared/contracts/*` with corresponding schema validators in `src/shared/schemas/*`.
