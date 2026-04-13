# Startup bootstrap progress card

The renderer startup card now uses a two-panel layout so users can see both:

1. **Stage checklist (left panel)**: high-level initialization milestones.
2. **Activity log (right panel)**: a terminal-style stream of progress events with timestamps.

## Behavioral notes

- Session language was updated from _saved sign-in_ to _previous session_ for clearer wording.
- The duplicated _Checking your saved sign-in_ checklist entry was replaced by two distinct stages:
  - **Checking for previous session**
  - **Validating previous session**
- The activity log is fed from the same initialization progress event stream as the stage checklist.
- Duplicate consecutive events are ignored to avoid noisy log output.
- The activity log is capped to the most recent 40 events to keep rendering stable.
- Workspace context loading now emits additional user-friendly technical details while waiting:
  - Initial request message indicates that identity service context/permissions are being requested.
  - Follow-up progress notices explain when waiting is likely due to service startup and include elapsed timing.
  - Near-timeout notices include elapsed and approximate remaining timeout budget.

## Implementation details

- Stage presentation updates live in:
  - `src/ui/shared/initialization/AppInitializationProgress.ts`
- Startup card rendering and activity log buffering live in:
  - `src/ui/App.tsx`
- Styling for the split layout and terminal-like display lives in:
  - `src/ui/styles/app.css`

## Runtime lifecycle UI states (Story 1.4.4)

Runtime-driven feature surfaces now use explicit lifecycle state messaging from backend lifecycle status (`DesktopPostLoginRuntimeStatus`) instead of transport assumptions:

1. **Unavailable**: user-first guidance explains why tools are not available yet (for example pre-login, logged out, shutting down).
2. **Warming**: user-first startup copy confirms tools are starting and reconnect automatically.
3. **Ready**: runtime-backed tools are available and interactive.
4. **Failed**: startup did not complete and retry guidance is shown; retry action is shown where supported.

Diagnostics shown in UI state details are sourced from backend lifecycle payload fields (`state`, `capabilityPhase`, `transport.phase`, `unavailableReason`, stage/failure metadata), not placeholder text.

### Runtime lifecycle state implementation anchors

- Route-level deferred runtime state mapping:
  - `src/ui/runtime/DeferredRuntimeFeatureGate.ts`
- Runtime status panel state mapping:
  - `src/ui/components/execution/McpRuntimeStatusPanel.tsx`
- Settings runtime lifecycle status wiring:
  - `src/ui/pages/SettingsPage.tsx`

### Runtime lifecycle state tests

- `src/ui/runtime/tests/DeferredRuntimeFeatureGate.test.ts`
- `src/ui/components/execution/tests/McpRuntimeStatusPanel.test.tsx`

## Runtime lifecycle refresh and backoff behavior (Story 1.4.5)

Renderer lifecycle refresh now follows explicit runtime lifecycle state instead of constant blind polling:

1. **Warming/failed**: polling uses bounded backoff so repeated unchanged startup/failure snapshots do not spam readiness requests.
2. **Ready**: polling cadence is reduced to a slower steady-state interval.
3. **Targeted refreshes**: lifecycle refresh is forced on explicit user-driven signals (manual refresh/retry, window focus, visible-tab return) so UI remains responsive.

Implementation anchors:

- `src/ui/runtime/RendererRuntimeLifecycleService.ts`
- `src/ui/runtime/tests/RendererRuntimeLifecycleService.test.ts`

## Desktop renderer lifecycle gate enforcement (Story 1.4.6)

Desktop renderer runtime paths must now pass through a shared lifecycle gate before touching runtime HTTP or realtime channels.

Required usage pattern:

1. Resolve desktop lifecycle readiness through `resolveDesktopRendererRuntimeLifecycleGate`.
2. If lifecycle is unavailable, return/show the explicit unavailable contract (`AI_LOOM_DESKTOP_FEATURE_API_UNAVAILABLE`) instead of attempting direct runtime transport calls.
3. Allow web/thin-client paths to continue without desktop lifecycle gating when no desktop runtime bridge exists.

Prohibited pattern:

- Direct desktop runtime HTTP/WebSocket usage that bypasses lifecycle readiness checks.

Implementation anchors:

- `src/ui/runtime/DesktopRendererRuntimeLifecycleGate.ts`
- `src/ui/services/RuntimeOperationsService.ts`
- `src/ui/shared/runtime/RuntimeRealtimeSubscriptionService.ts`

Tests:

- `src/ui/runtime/tests/DesktopRendererRuntimeLifecycleGate.test.ts`
- `src/ui/runtime/tests/DesktopRuntimeLifecycleGatingConventions.test.ts`
- `src/ui/services/tests/RuntimeOperationsService.test.ts`
- `src/ui/shared/runtime/tests/RuntimeRealtimeSubscriptionService.test.ts`

## Development runtime diagnostics surface (Story 1.4.7)

Desktop settings now include a development-only runtime diagnostics panel so activation issues can be diagnosed from renderer state without exposing internals in normal user flows.

How to use:

1. Open **Settings**.
2. Go to **Development Tools**.
3. Expand **Advanced development settings**.
4. Review the **Desktop runtime diagnostics (development)** panel.

What it shows:

- current backend lifecycle state (`state`, `capabilityPhase`, `transport.phase`),
- resolved blocking dependency category (`authentication`, `capability-activation`, `runtime-supervisor`, `control-plane-transport`, `unknown`),
- currently blocking activation stage (if any),
- recent transition timestamps from lifecycle, transport, warmup request, failure, and activation stage updates,
- an inspectable JSON lifecycle snapshot for local troubleshooting.

Availability and clutter controls:

- The diagnostics panel is gated by development feature-flag rules and is hidden in standard production flows by default.
- Explicit overrides are supported with `VITE_ENABLE_DESKTOP_RUNTIME_DIAGNOSTICS` (or `ENABLE_DESKTOP_RUNTIME_DIAGNOSTICS`) for local troubleshooting workflows.

Implementation anchors:

- `src/ui/features/DesktopRuntimeDiagnosticsFeatureFlag.ts`
- `src/ui/runtime/DesktopRuntimeDiagnosticsModel.ts`
- `src/ui/components/execution/DesktopRuntimeDiagnosticsPanel.tsx`
- `src/ui/pages/SettingsPage.tsx`

Tests:

- `src/ui/runtime/tests/DesktopRuntimeDiagnosticsModel.test.ts`
- `src/ui/components/execution/tests/DesktopRuntimeDiagnosticsPanel.test.tsx`
- `src/ui/pages/tests/SettingsPage.test.ts`
