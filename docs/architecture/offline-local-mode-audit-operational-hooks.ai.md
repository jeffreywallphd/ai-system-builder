# AI Companion: Offline Local-Mode Audit and Operational Event Hooks

## Human doc

- `docs/architecture/offline-local-mode-audit-operational-hooks.md`

## Purpose

Story 19.2.7 adds structured hook emissions for offline transitions and reconnect outcomes so offline behavior is visible in governance/operational systems.

## Canonical seams

- `src/application/common/OfflineOperationalEventPorts.ts`
- `src/application/common/OfflineControlledResynchronizationCoordinator.ts`
- `src/hosts/desktop/DesktopConnectivityStateService.ts`
- `src/hosts/desktop/DesktopOfflineResynchronizationHost.ts`
- `src/infrastructure/api/system-runtime/DesktopOfflineOperationalEventSink.ts`

## First-scope emitted outcomes

- `offline-entered`
- `offline-exited`
- `replay-succeeded`
- `replay-failed`
- `conflict-detected`
- `protected-local-execution-registered`

## Safety posture

- emit from host/application boundaries only (not UI components);
- include actor/workspace/resource context only when available;
- keep details user-safe and sanitized;
- omit replay payload bodies, tokens/credentials/secrets, raw diagnostics/path-like fields.
