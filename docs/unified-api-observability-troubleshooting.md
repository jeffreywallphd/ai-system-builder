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

## Desktop main-process operational sinks

Desktop runtime/server observability events now flow through a single Electron main-process logger adapter:

- Console sink: structured JSON emitted in the Electron main process (visible in terminal during development).
- File sink: `desktop-operational.log` under `app.getPath("logs")/ai-loom-studio` (for example, on macOS: `~/Library/Logs/ai-loom-studio/desktop-operational.log`).

This adapter is injected into:

1. auth-minimal server host startup (`startAuthMinimalServerHostAssembly(...)` host logger path);
2. deferred desktop runtime composition for `SystemRuntimeBackendApi` observability.

Redaction behavior is preserved because upstream observability adapters still sanitize payloads before logger delivery.

### Dev vs packaged inspection

1. Development (`npm run start:desktop`): inspect terminal output for JSON events and correlate with `desktop-operational.log`.
2. Packaged desktop builds: inspect `app.getPath(\"logs\")/ai-loom-studio/desktop-operational.log` on the target OS.
3. Use `correlationId`, `requestId`, `executionId`, or `assetId` to trace runtime/image-upload sequences end-to-end.

## Troubleshooting flow

1. Collect `x-correlation-id` (or `x-request-id`) from the failing client response/frame.
2. Search server logs for matching `correlationId` or `requestId`.
3. If no server event exists, inspect shared-client diagnostics for timeout/transport failures and resolved request URL.
4. Inspect structured server event sequence (`received` -> `completed` or websocket failure/lifecycle events).
5. Validate that payloads/messages remain redacted; if sensitive values appear, treat as regression.
6. For realtime failures, map websocket close code and error code with the same correlation id.

## Authorization denial triage flow

Use this when a request is denied and operators need to localize where and why the decision/failure occurred.

Canonical diagnostic contracts:

1. schema and projection boundaries: `src/shared/contracts/authorization/AuthorizationDiagnosticsContracts.ts`
2. reason-code and provenance catalogs: `src/shared/contracts/authorization/AuthorizationDiagnosticCatalogs.ts`
3. integration baseline: `docs/architecture/authorization-enforcement-integration-patterns.md`

Primary emission seams by provenance stage:

1. `route`/`api`/`transport-mapping`:
   - `src/infrastructure/transport/authorization/AuthorizationTransportPolicyGuard.ts`
   - `src/infrastructure/transport/authorization/AuthorizationTransportAdapters.ts`
   - `src/infrastructure/transport/http-server/identity/IdentityHttpServerErrorTranslation.ts`
2. `permission-snapshot`/`scope-filtering`/`evaluator-resolution`/`final-decision-emission`/`adapter-failure`:
   - `src/application/authorization/use-cases/AuthorizationDecisionDiagnostics.ts`
   - `src/application/authorization/use-cases/AuthorizationPolicyDecisionEvaluator.ts`
3. adapter/repository lookup failures:
   - `src/infrastructure/persistence/authorization/SqliteAuthorizationPolicyReadAdapter.ts`

Step-by-step interpretation:

1. Start with response `error.correlationId` (or `x-correlation-id`) and locate all events sharing that id.
2. Order events by provenance stage:
   - `permission-snapshot` -> `scope-filtering` -> `evaluator-resolution` -> `final-decision-emission`
   - include `adapter-failure` or `transport-mapping` when present
3. Read `reasonCode` at each stage:
   - policy denial examples: `no-effective-permission`, `scope-mismatch`
   - boundary failure examples: `authorization-repository-lookup-failed`, `authorization-adapter-timeout`, `transport-denied`
4. Confirm the first stage where a stable deny/failure appears. That stage is the owning failure boundary.
5. Use `evidence.missing` and counts to distinguish "data unavailable" from "policy denied with complete evidence".

Security and redaction boundaries:

1. External diagnostics are projected and must not contain actor IDs, resource identifiers, or identifier arrays.
2. Secret-sensitive/admin-sensitive surfaces additionally suppress permission keys and sensitive target metadata.
3. Runtime details and extensions are sanitized; `.public`/`:public` extension keys are the only externally retained extension paths.

Relationship to invariant and composed integration tests:

1. Use invariant coverage to verify policy truth under workspace/scope permutations:
   - `src/testing/invariants/tests`
   - `src/application/authorization/tests/*InvariantCoverage.test.ts`
2. Use composed runtime regression coverage for cross-layer drift and denial provenance continuity:
   - `src/application/authorization/tests/AuthorizationRuntimeContextDriftRegression.test.ts`

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
