# Offline Local-Mode Audit and Operational Event Hooks

Story 19.2.7 adds explicit event hooks for offline transitions and reconnect outcomes so governance and operational tooling can observe desktop-local behavior without reading UI-only state.

## Purpose

- expose offline entry/exit and reconnect outcomes through structured hooks;
- keep emissions at host/application boundaries, not UI components;
- enforce safe payload posture with actor/workspace/resource context and sensitive-data redaction.

## Canonical implementation seams

- event contract and sanitization seam:
  - `src/application/common/OfflineOperationalEventPorts.ts`
- reconnect outcome emission seam:
  - `src/application/common/OfflineControlledResynchronizationCoordinator.ts`
- desktop connectivity transition emission seam:
  - `src/hosts/desktop/DesktopConnectivityStateService.ts`
- desktop resynchronization runtime wiring seam:
  - `src/hosts/desktop/DesktopOfflineResynchronizationHost.ts`
- runtime operational/audit adapter seam:
  - `src/infrastructure/api/system-runtime/DesktopOfflineOperationalEventSink.ts`

## Representative event outcomes in first production scope

- `offline-entered`
- `offline-exited`
- `replay-succeeded`
- `replay-failed`
- `conflict-detected`
- `protected-local-execution-registered`

## Routing model to existing systems

- operational visibility:
  - offline transition events publish via runtime connectivity event hooks.
- governance visibility:
  - replay/conflict/recovery/protected-registration outcomes publish via runtime audit/governance event hooks with user-safe details only.

## Safe payload boundary

Recorded context is intentionally bounded to:

- actor identity context (`actorUserIdentityId` or service fallback);
- workspace scope (`workspaceId` when known);
- replay target references (`operationId`, `resourceClass`, `resourceId`);
- normalized outcome (`succeeded`, `failed`, `conflict`);
- short summary and sanitized details map.

Sensitive or raw content is intentionally omitted/redacted:

- replay payload content and raw request bodies;
- tokens, credentials, and secret material;
- internal traces/diagnostics/path-like fields;
- unbounded arrays/objects/strings.

## Non-goals for this story

- no UI-component-level event emission;
- no promotion of local state to authoritative source;
- no new offline decision categories beyond existing reconciliation model.

## Testing baseline

- `src/application/common/tests/OfflineOperationalEventPorts.test.ts`
- `src/application/common/tests/OfflineControlledResynchronizationCoordinator.test.ts`
- `src/hosts/desktop/tests/DesktopConnectivityStateService.test.ts`
- `src/infrastructure/api/system-runtime/tests/DesktopOfflineOperationalEventSink.test.ts`
