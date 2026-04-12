# Execution Node Management and Readiness API Contracts

## Story alignment

- Feature 5: Node-Based Execution and Backend Management
- Epic 5.1: Execution Node Domain, Capability Model, and Management Contracts
- Story 5.1.4: Define shared DTOs and schemas for node management and execution readiness APIs

## Purpose

Define shared, authoritative DTO and schema contracts for execution-node management and readiness surfaces so desktop, thin-client, and future admin-lite/admin consumers can query backend operational posture without probing execution backends directly.

## Implemented files

- `src/shared/contracts/nodes/ExecutionNodeManagementApiContracts.ts`
- `src/shared/contracts/nodes/tests/ExecutionNodeManagementApiContracts.test.ts`
- `src/shared/schemas/nodes/ExecutionNodeManagementApiSchemaContracts.ts`
- `src/shared/schemas/nodes/tests/ExecutionNodeManagementApiSchemaContracts.test.ts`
- `src/shared/dto/nodes/ExecutionNodeManagementApiDtos.ts`
- `src/shared/dto/nodes/tests/ExecutionNodeManagementApiDtos.test.ts`

## API contract coverage

The shared execution-node transport contracts now include:

- node management list/get request and response DTOs
- node availability override request/response DTOs for authoritative operational control actions (`enable|disable|suppress`)
- node health and operational summaries suitable for operational UX and admin inventory views, including explicit administrative availability override metadata (`availabilityOverrideMode`, optional suppression window/reason, override update timestamp)
- backend capability and backend-readiness summaries without raw adapter probe payloads
- execution-readiness check request/response DTOs for run launch/readiness UX
- node-eligibility check request/response DTOs for schedulability and routing previews
- backend availability summary request/response DTOs for admin-facing backend posture rollups

## Safety and normalization posture

- Public DTOs intentionally exclude internal transport configuration and secrets (`endpointRef`, connection secret refs, raw probe payload refs).
- Internal representations are modeled separately (`ExecutionNodeInternal*`) and converted through explicit projection helpers:
  - `toExecutionNodeSummaryDto(...)`
  - `toExecutionNodeDetailDto(...)`
  - `toExecutionNodeBackendAvailabilitySummaryDto(...)`
- Response DTO builders in `src/shared/dto/nodes/ExecutionNodeManagementApiDtos.ts` preserve immutable payload construction while retaining safe public shape boundaries.

## Schema validation posture

`ExecutionNodeManagementApiSchemaContracts.ts` enforces strict request/response validation with typed parse helpers and schema-specific validation errors.

Validation includes:

- strict unknown-field rejection for public payloads
- enum/value constraints for lifecycle, health, trust, and readiness states
- operational availability override invariants (`suppressed` mode requires suppression expiry; non-suppressed modes reject suppression expiry)
- timestamp and identifier normalization rules
- readiness and eligibility coherence rules (for example, `eligible` requires `compatible=true` and `routable=true`)
- backend availability bucket totals (`totalNodeCount` must match readiness bucket sums)

## Architectural boundary alignment

- User identity and node trust semantics remain separate from execution-node routing/readiness payloads.
- Backend adapter internals stay hidden behind authoritative node-management projections.
- Contracts are scheduler-ready and compatible with future multi-node/hybrid-node policy expansion without transport redesign.
