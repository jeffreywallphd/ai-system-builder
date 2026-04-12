# AI Companion: Unified API Observability and Troubleshooting

## Purpose

- Story 14.2.7 implementation reference for authoritative transport observability and safe failure handling.

## Canonical implementation seam

- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`

## Operational signals

Structured events cover:

1. HTTP request receive/complete
2. CORS + secure transport denials
3. route unhandled failures
4. websocket upgrade accepted/denied
5. runtime realtime subscription accepted/error
6. websocket lifecycle transitions

Shared client transport diagnostics are emitted by `src/ui/shared/api/SharedApiClient.ts` through `onDiagnosticEvent` for retries, timeout/cancellation, and transport failures (no-response conditions).

## Correlation guarantees

- `x-request-id`: always emitted.
- `x-correlation-id`: client-supplied when safe, otherwise request-id fallback.
- HTTP error envelopes include `error.correlationId`.
- WebSocket realtime error frames include `error.correlationId`.
- log events carry `requestId` and `correlationId`.

## Redaction guarantees

- Event details are sanitized before logger/hook emission.
- Payload logging uses sensitive-field redaction.
- Realtime websocket failure messages are normalized to avoid leaking secret/path/token internals.

## Hook

- `createIdentityHttpServer({ observability: { onOperationalEvent } })`
- Hook receives sanitized `IdentityHttpServerLogEvent` payloads.

## Desktop sink coverage

- Electron main now uses one operational logger adapter for runtime/server observability.
- Sink targets:
  - main-process console JSON (dev terminal visibility),
  - `desktop-operational.log` in `app.getPath("logs")/ai-loom-studio`.
- Injection points:
  - `startAuthMinimalServerHostAssembly(...)` host logger option,
  - deferred-runtime `SystemRuntimeBackendApi` observability logger option.
- Redaction remains upstream in observability adapters; sink writes already-sanitized events.

## Troubleshooting quick flow

1. Capture correlation id from client response/frame.
2. If no server event exists, inspect shared client diagnostics (request URL, method, attempt, transport failure metadata).
3. Locate matching server events by `correlationId` or `requestId`.
4. Follow event sequence and status codes.
5. Confirm redaction remains intact.

## Story 14.3.8 readiness checks

- Cross-surface parity regression:
  - `src/ui/shared/tests/UnifiedApiCrossSurfaceRegression.test.ts`
  - Verifies desktop and thin-client consistency for bootstrap, reads/mutations, realtime subscribe behavior, authorization denials, and transport failures.
- Route/contract drift verification:
  - `src/infrastructure/transport/http-server/tests/UnifiedApiContractDriftVerification.test.ts`
  - Validates converged client route usage remains aligned with authoritative route-family registration and convergence contract domains.
