# Audit Reference Normalization Layer

This note captures Story 18.1.4 for Feature 18 / Epic 18.1.

## Scope

Implemented in this slice:

- reusable audit reference normalization helpers in `src/application/audit/shared`
- authoritative audit service integration so every recorded event uses normalized actor/workspace/resource/correlation references
- canonical action-context reference capture (`sessionRef`, `deviceRef`, `nodeRef`) in user-safe payload details
- tests validating normalization behavior and service-level application of normalized references

Out of scope in this slice:

- migration of every existing feature-specific audit hook to authoritative recording
- persistence/index schema changes for new secondary query indexes
- UI changes for new reference-context projection fields

## Canonical files

- `src/application/audit/shared/AuditReferenceNormalization.ts`
- `src/application/audit/ports/AuthoritativeAuditRecordingPorts.ts`
- `src/application/audit/use-cases/AuthoritativeAuditRecordingService.ts`
- `src/application/audit/tests/AuditReferenceNormalization.test.ts`
- `src/application/audit/tests/AuthoritativeAuditRecordingService.test.ts`

## Normalization contract

The shared normalization layer enforces consistent reference posture across audit categories:

- actor references:
  - trims and canonicalizes actor identifiers
  - backfills `actorUserIdentityId` / `actorServiceId` from `actorId` when omitted for user/service actors
  - normalizes session identifiers for stable actor-session joins
- scope references:
  - normalizes workspace identifiers
  - keeps `global` scope workspace-free and validates workspace presence for workspace scope
- protected-resource references:
  - canonicalizes `resourceType`
  - normalizes logical `resourceId`
  - derives canonical `resourceRef` as `resourceType:resourceId`
  - avoids passing through feature-supplied raw internal refs directly
- correlation identifiers:
  - normalizes `correlationId` and `requestId` for stable cross-event joins
- action context references:
  - supports normalized session/device/node references in payload `referenceContext`

## Authoritative service behavior updates

`AuthoritativeAuditRecordingService` now normalizes references before creating canonical events:

1. source/action validation and action normalization (existing)
2. actor/scope/resource/correlation/request/action-context normalization (new)
3. payload redaction/sanitization, including injected normalized `referenceContext` (new)
4. canonical event creation + append to ledger (existing)

This keeps per-feature audit emitters from inventing divergent actor/workspace/resource formats.

## Test coverage

- `AuditReferenceNormalization.test.ts`
  - actor normalization/backfill behavior
  - scope/resource canonicalization behavior
  - correlation/action-context normalization behavior
- `AuthoritativeAuditRecordingService.test.ts`
  - service-level reference normalization application
  - protection against leaking caller-supplied raw resource refs into canonical resource references
