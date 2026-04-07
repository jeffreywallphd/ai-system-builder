# AI Companion: Audit Governance Realtime Event Publication

## Story scope

Story 18.3.2 publishes authoritative audit/governance writes to the shared runtime realtime stream, with permission-aware subscription boundaries and user-safe payload discipline.

## Human doc

- `docs/architecture/audit-governance-realtime-event-publication.md`

## Implemented seams

- Shared realtime contract/schema expansion for audit/governance stream category/topic/payload:
  - `src/shared/contracts/runtime/SystemRuntimeRealtimeEventContracts.ts`
  - `src/shared/schemas/runtime/SystemRuntimeRealtimeEventSchemaContracts.ts`
- Shared runtime stream publication boundary:
  - `src/infrastructure/api/system-runtime/AuthoritativeRuntimeEventStream.ts`
  - `src/infrastructure/api/system-runtime/SystemRuntimeBackendApi.ts`
- Authoritative audit append to realtime publication bridge:
  - `src/application/audit/ports/AuthoritativeAuditRecordingPorts.ts`
  - `src/application/audit/use-cases/AuthoritativeAuditRecordingService.ts`
  - `src/infrastructure/audit/RuntimeBackendAuditGovernanceRealtimePublisher.ts`
- Websocket authorization gate for audit/governance realtime subscription:
  - `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`

## Publication model

- Topic: `runtime.audit.governance`
- Category: `audit-governance`
- Event kinds are category-derived:
  - `security-sensitive-action-recorded`
  - `administrative-action-recorded`
  - `sharing-action-recorded`
  - `policy-action-recorded`
  - `orchestration-action-recorded`
  - `protected-data-action-recorded`
- Payload carries user-safe audit summary semantics and redaction posture; admin-only details are excluded.

## Authorization and safety posture

- Audit/governance realtime topics are only accepted for websocket `stream-control` purpose.
- Subscription is additionally authorization-probed against `listGovernanceAuditEvents(...)` before acceptance.
- Missing audit backend or failed authorization probe yields `forbidden`.
- Realtime fanout is best-effort and triggered only after authoritative append succeeds with `changed: true`.

## Tests added/updated

- `src/application/audit/tests/AuthoritativeAuditRecordingService.test.ts`
- `src/infrastructure/audit/tests/AuthoritativeSecurityAuditAdapters.test.ts`
- `src/shared/contracts/runtime/tests/SystemRuntimeRealtimeEventContracts.test.ts`
- `src/shared/schemas/runtime/tests/SystemRuntimeRealtimeEventSchemaContracts.test.ts`
- `src/infrastructure/api/system-runtime/tests/AuthoritativeRuntimeEventStream.test.ts`
- `src/infrastructure/api/system-runtime/tests/SystemRuntimeBackendApi.test.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerRuntimeRealtimeWebSocket.test.ts`
