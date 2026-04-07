# Unified API Observability and Troubleshooting

## Story alignment

- Feature: 14, Desktop and Thin-Client Unified API Surface
- Epic: 14.2, Deliver Authoritative Server Endpoints and Real-Time APIs for Shared Client Use
- Story: 14.2.7, Add server-side observability, redaction, and failure handling for the shared API surface

## What is emitted

The authoritative HTTP/WebSocket transport in `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts` now emits structured operational events for:

1. request receipt and completion
2. CORS and secure-transport failures
3. unhandled route failures
4. websocket upgrade acceptance/denial
5. runtime realtime websocket subscription and failure paths
6. websocket channel lifecycle transitions

All transport log events flow through centralized event sanitization before logger/hook emission.

The shared UI HTTP client in `src/ui/shared/api/SharedApiClient.ts` also emits structured client-side diagnostics (via `onDiagnosticEvent`) for:

1. request retries
2. request timeout/cancellation
3. transport-level failures before response receipt

Identity auth wiring in `src/ui/services/IdentityAuthService.ts` logs these events with request method/URL/attempt metadata.

## Correlation model

For every HTTP request and WebSocket upgrade:

1. `x-request-id` is generated server-side.
2. `x-correlation-id` is accepted from client headers when safe (`x-correlation-id` or `x-request-id`) and otherwise falls back to request id.
3. both headers are returned to clients.
4. error envelopes include `error.correlationId`.
5. websocket error frames include `error.correlationId`.

This allows desktop and thin-client diagnostics to align client-visible failures with server logs.

## Redaction and safety

Transport observability uses centralized redaction across event details and failure message paths:

1. request/response payload logging uses sensitive-field redaction
2. operational event details are sanitized before logger/hook delivery
3. websocket failure text is normalized to avoid leaking secrets, prompts, tokens, or storage internals
4. internal failure responses remain stable and non-diagnostic to clients beyond safe error metadata

## Observability hook integration

`createIdentityHttpServer` now supports:

- `observability.onOperationalEvent(event)`

The hook receives the same sanitized `IdentityHttpServerLogEvent` shape that the transport logger receives, including request and correlation identifiers.

## Troubleshooting flow

1. Collect `x-correlation-id` (or `x-request-id`) from the failing client response/frame.
2. Search server logs for matching `correlationId` or `requestId`.
3. If no server event exists, inspect shared-client diagnostics for timeout/transport failures and resolved request URL.
4. Inspect structured server event sequence (`received` -> `completed` or websocket failure/lifecycle events).
5. Validate that payloads/messages remain redacted; if sensitive values appear, treat as regression.
6. For realtime failures, map websocket close code and error code with the same correlation id.

## Regression checklist

1. HTTP error responses include `error.correlationId` and response headers.
2. Websocket error frames include `error.correlationId`.
3. Sensitive payload fields and tokens are redacted from logs and hooks.
4. Route and websocket failure paths return safe, normalized error messages.

## Cross-surface production-readiness verification

Feature 14 final hardening validates that these observability and failure semantics stay consistent for desktop and thin-client clients through shared authoritative APIs:

1. `src/ui/shared/tests/UnifiedApiCrossSurfaceRegression.test.ts`
   - exercises representative bootstrap, read, mutation, realtime subscribe, authorization denial, and transport-failure flows across both client channels.
2. `src/infrastructure/transport/http-server/tests/UnifiedApiContractDriftVerification.test.ts`
   - guards against route-prefix and contract drift between converged shared clients and authoritative route registration.
