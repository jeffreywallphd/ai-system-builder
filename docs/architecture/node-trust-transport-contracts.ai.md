# AI Companion: Node Trust Transport and IPC Contracts

## Purpose

Quick baseline for Story 5.1.5 shared node trust transport DTOs and schema validation contracts (Feature 5 / Epic 5.1).

## Canonical files

- `src/shared/contracts/nodes/NodeTrustApiContracts.ts`
- `src/shared/contracts/nodes/tests/NodeTrustApiContracts.test.ts`
- `src/shared/schemas/nodes/NodeTrustApiSchemaContracts.ts`
- `src/shared/schemas/nodes/tests/NodeTrustApiSchemaContracts.test.ts`

## DTO coverage

- enrollment submission request/response
- pending enrollment summaries/list response
- approval/rejection/revocation action requests
- node heartbeat payload/response
- node detail and enrollment detail views
- capability profile transport serialization

## Public vs internal boundary

- Admin-visible DTOs:
  - `NodeDetailDto`
  - `NodeEnrollmentDetailDto`
  - `NodePendingEnrollmentSummaryDto`
- Internal DTOs:
  - `NodeInternalDetailDto`
  - `NodeInternalEnrollmentDetailDto`
- Safe projection helpers:
  - `toNodeDetailDto(...)`
  - `toNodeEnrollmentDetailDto(...)`
  - `toNodePendingEnrollmentSummaryDto(...)`

## Validation posture

- All node-trust transport payloads are validated in `NodeTrustApiSchemaContracts.ts` using strict zod schemas.
- Typed validation failures surface through `NodeTrustApiSchemaValidationError`.
- Schema checks include:
  - trusted/revoked lifecycle coherence,
  - pending-summary status restrictions,
  - capability dedupe,
  - bootstrap envelope minimum-content checks,
  - bootstrap public trust-material metadata validation (reference + key fields),
  - rejection of internal-only fields in admin schemas.

## Adapter guidance

- Parse transport payloads at HTTP/IPC boundaries with `parse*` helpers before entering use cases.
- Return admin-safe DTOs by default; only use internal DTOs for explicit internal service boundaries.
