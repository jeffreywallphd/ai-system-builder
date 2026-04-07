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

## Troubleshooting quick flow

1. Capture correlation id from client response/frame.
2. Locate matching server events by `correlationId` or `requestId`.
3. Follow event sequence and status codes.
4. Confirm redaction remains intact.
