# AI Companion: Execution Node Management and Readiness API Contracts

## Story scope

Story 5.1.4 defines shared DTO/schema contracts for authoritative execution-node management and execution-readiness APIs used by desktop and future thin-client/admin surfaces.

## Implemented files

- `src/shared/contracts/nodes/ExecutionNodeManagementApiContracts.ts`
- `src/shared/contracts/nodes/tests/ExecutionNodeManagementApiContracts.test.ts`
- `src/shared/schemas/nodes/ExecutionNodeManagementApiSchemaContracts.ts`
- `src/shared/schemas/nodes/tests/ExecutionNodeManagementApiSchemaContracts.test.ts`
- `src/shared/dto/nodes/ExecutionNodeManagementApiDtos.ts`
- `src/shared/dto/nodes/tests/ExecutionNodeManagementApiDtos.test.ts`
- Human doc: `docs/architecture/execution-node-management-readiness-api-contracts.md`

## Core delivery

- Added canonical request/response DTOs for:
  - execution-node list/get management reads,
  - execution-node availability override control actions (`enable|disable|suppress`),
  - execution-readiness checks,
  - node eligibility checks,
  - backend availability/readiness summaries.
- Extended operational summary DTOs with explicit administrative availability override metadata (`enabled|disabled|suppressed`, optional suppression expiry/reason, override timestamp) so admin policy controls are queryable independently from probe health.
- Added explicit public vs internal DTO separation:
  - public DTOs (`ExecutionNodeSummaryDto`, `ExecutionNodeDetailDto`, backend availability summaries),
  - internal DTOs (`ExecutionNodeInternalSummaryDto`, `ExecutionNodeInternalDetailDto`, backend internal summaries),
  - explicit safe projection helpers that remove internal transport references.
- Added strict schema parse/validation helpers with typed failure surfaces via:
  - `ExecutionNodeManagementApiSchemaValidationError`.
- Added schema invariants for operational availability override coherence (suppression mode and suppression-expiry requirements).

## Boundary posture

- Authoritative API posture: clients consume normalized server-owned operational state rather than backend probes.
- No leakage of backend-native transport details or secret references in external contracts.
- Keeps node trust posture fields explicit but separate from user identity and backend adapter internals.

## Validation posture

Tests cover:

- route/version contract catalog expectations,
- internal-to-public projection redaction behavior,
- strict schema rejection for leaked internal fields,
- readiness/eligibility coherence constraints,
- backend availability bucket-count consistency checks.
