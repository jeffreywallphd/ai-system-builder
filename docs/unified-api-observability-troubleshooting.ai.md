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

## Authorization denial triage flow

Use when a request is denied and you must localize failure provenance across route, API, use-case, evaluator, and adapter seams.

Canonical contracts:

1. schema + projection/redaction boundaries: `src/shared/contracts/authorization/AuthorizationDiagnosticsContracts.ts`
2. reason/provenance catalogs: `src/shared/contracts/authorization/AuthorizationDiagnosticCatalogs.ts`
3. integration baseline: `docs/architecture/authorization-enforcement-integration-patterns.md`

Where diagnostics are emitted:

1. route/API/transport mapping:
   - `src/infrastructure/transport/authorization/AuthorizationTransportPolicyGuard.ts`
   - `src/infrastructure/transport/authorization/AuthorizationTransportAdapters.ts`
   - `src/infrastructure/transport/http-server/identity/IdentityHttpServerErrorTranslation.ts`
2. permission/evaluator stages:
   - `src/application/authorization/use-cases/AuthorizationDecisionDiagnostics.ts`
   - `src/application/authorization/use-cases/AuthorizationPolicyDecisionEvaluator.ts`
3. adapter/repository failures:
   - `src/infrastructure/persistence/authorization/SqliteAuthorizationPolicyReadAdapter.ts`

Interpretation sequence:

1. start from response `error.correlationId` or `x-correlation-id`
2. gather same-correlation events and order by stage:
   - `permission-snapshot` -> `scope-filtering` -> `evaluator-resolution` -> `final-decision-emission`
   - include `adapter-failure` and `transport-mapping` when present
3. use `reasonCode` to classify policy denials (`no-effective-permission`, `scope-mismatch`) versus boundary failures (`authorization-repository-lookup-failed`, `authorization-adapter-timeout`, `transport-denied`)
4. first stage with stable deny/failure is the owning failure boundary
5. use `evidence.missing` + counts to distinguish missing upstream evidence from complete policy-deny evidence

Security boundary expectations:

1. external diagnostics stay projected/redacted (no actor IDs, target identifiers, or identifier arrays)
2. secret-sensitive/admin-sensitive surfaces also suppress permission keys and sensitive target metadata
3. extension values are sanitized; only `.public`/`:public` extensions are externally retained

Invariant relationship:

1. invariant suites prove policy truth under scope/workspace permutations:
   - `src/testing/invariants/tests`
   - `src/application/authorization/tests/*InvariantCoverage.test.ts`
2. composed runtime regression proves cross-layer provenance continuity:
   - `src/application/authorization/tests/AuthorizationRuntimeContextDriftRegression.test.ts`

## Story 14.3.8 readiness checks

- Cross-surface parity regression:
  - `src/ui/shared/tests/UnifiedApiCrossSurfaceRegression.test.ts`
  - Verifies desktop and thin-client consistency for bootstrap, reads/mutations, realtime subscribe behavior, authorization denials, and transport failures.
- Route/contract drift verification:
  - `src/infrastructure/transport/http-server/tests/UnifiedApiContractDriftVerification.test.ts`
  - Validates converged client route usage remains aligned with authoritative route-family registration and convergence contract domains.
