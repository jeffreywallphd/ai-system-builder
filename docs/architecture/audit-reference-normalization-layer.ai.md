# AI Companion: Audit Reference Normalization Layer

## Purpose

Story 18.1.4 adds a reusable audit normalization layer so actor/workspace/resource/session/device/node/correlation references are represented consistently before canonical event persistence.

## Canonical files

- `src/application/audit/shared/AuditReferenceNormalization.ts`
- `src/application/audit/ports/AuthoritativeAuditRecordingPorts.ts`
- `src/application/audit/use-cases/AuthoritativeAuditRecordingService.ts`
- `src/application/audit/tests/AuditReferenceNormalization.test.ts`
- `src/application/audit/tests/AuthoritativeAuditRecordingService.test.ts`
- `docs/architecture/audit-reference-normalization-layer.md`

## What was added

- shared normalization helpers for:
  - actor references
  - workspace scope references
  - protected-resource references
  - correlation/request identifiers
  - action context references (`sessionRef`, `deviceRef`, `nodeRef`)
- service integration so normalized references are always used for authoritative audit events
- canonical payload `referenceContext` injection for normalized action context

## Why this matters

- cross-feature audit events now use the same canonical reference shape
- common identifiers are stable for ledger query/join workflows
- caller-supplied internal storage/db references are not passed through as canonical resource refs

## Test coverage

- unit tests for the shared normalization helper behavior
- service tests confirming normalized references are emitted in canonical events
