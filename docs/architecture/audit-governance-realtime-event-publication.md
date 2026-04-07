# Audit Governance Realtime Event Publication

## Story alignment

- Feature 18: Audit, Governance, and Security Event Ledger
- Epic 18.3: Deliver Governance Visibility, Event Streaming, and Production Hardening for the Audit Ledger
- Story 18.3.2: Implement real-time audit and governance event publication for authorized consumers

## Purpose

Publish authoritative audit/governance writes to the shared runtime realtime stream so authorized operational/admin surfaces can observe high-value governance changes without polling-only workflows.

## Canonical implementation map

- Shared runtime realtime contracts/schemas:
  - `src/shared/contracts/runtime/SystemRuntimeRealtimeEventContracts.ts`
  - `src/shared/schemas/runtime/SystemRuntimeRealtimeEventSchemaContracts.ts`
- Shared runtime stream publication:
  - `src/infrastructure/api/system-runtime/AuthoritativeRuntimeEventStream.ts`
  - `src/infrastructure/api/system-runtime/SystemRuntimeBackendApi.ts`
- Authoritative audit-to-realtime bridge:
  - `src/application/audit/ports/AuthoritativeAuditRecordingPorts.ts`
  - `src/application/audit/use-cases/AuthoritativeAuditRecordingService.ts`
  - `src/infrastructure/audit/RuntimeBackendAuditGovernanceRealtimePublisher.ts`
- Websocket subscription authorization boundary:
  - `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`

## Canonical topic/category/payload

- Topic: `runtime.audit.governance`
- Category: `audit-governance`
- Payload shape: user-safe projection only
  - canonical identifiers (`eventId`, `eventType`, `action`, `occurredAt`, `recordedAt`)
  - actor/scope/resource references (`actorId`, `actorKind`, `workspaceId`, optional resource refs)
  - governance semantics (`auditCategory`, category-derived `eventKind`, `outcome`)
  - protection posture (`hasProtectedData`, `redactionReasons`)
  - redaction-safe details (`details` mapped from canonical `userSafeDetails` only)

`adminOnlyDetails` are never published in realtime payloads.

## Authoritative publication trigger

- Realtime publication is emitted only after canonical append succeeds and reports `changed: true`.
- Replay/idempotency results (`changed: false`) are not republished.
- Publication remains best-effort and cannot block authoritative ledger append success.

## Subscription authorization boundary

- Audit/governance realtime topics are only allowed for websocket `stream-control` purpose.
- Identity websocket runtime-realtime subscription handling performs an explicit audit-governance authorization probe through `AuditLedgerBackendApi.listGovernanceAuditEvents(...)` for the actor/workspace before accepting audit-governance topics.
- If authorization probe fails or audit backend is unavailable, subscription is rejected with `forbidden`.

## Tests

- `src/application/audit/tests/AuthoritativeAuditRecordingService.test.ts`
- `src/infrastructure/audit/tests/AuthoritativeSecurityAuditAdapters.test.ts`
- `src/shared/contracts/runtime/tests/SystemRuntimeRealtimeEventContracts.test.ts`
- `src/shared/schemas/runtime/tests/SystemRuntimeRealtimeEventSchemaContracts.test.ts`
- `src/infrastructure/api/system-runtime/tests/AuthoritativeRuntimeEventStream.test.ts`
- `src/infrastructure/api/system-runtime/tests/SystemRuntimeBackendApi.test.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerRuntimeRealtimeWebSocket.test.ts`
