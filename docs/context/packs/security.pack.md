# Context Pack: Security Architecture

- Pack name: `security`

## Purpose

Summarize the planned security architecture direction for implementation prompts.

## Canonical reference

- ADR-0015 is the canonical security architecture and policy-boundary source.

## Core posture

- Security is cross-cutting but not monolithic.
- Shared security primitives belong in security contracts/ports/adapters.
- Feature code stays in feature areas and consumes shared security seams.
- First implementation target: HTTPS + LAN pairing bearer token.
- Bearer tokens authenticate clients; HTTPS/TLS provides confidentiality/integrity.

## Current implementation snapshot

- Security modes in use:
  - `disabled-dev`
  - `lan-https-token`
- Required env for `lan-https-token`:
  - `AI_SYSTEM_BUILDER_SECURITY_MODE=lan-https-token`
  - `AI_SYSTEM_BUILDER_TLS_CERT_MODE=manual|auto-self-signed|auto-local-ca`
  - `SERVER_TOKEN_HASH_SECRET`
- Optional env/config commonly used:
  - `AI_SYSTEM_BUILDER_PAIRING_ENABLED`
  - `AI_SYSTEM_BUILDER_SECURITY_STORE_PATH`
  - `SERVER_STORAGE_ROOT`
  - `SERVER_RUNTIME_ROOT`
- Security store defaults under server storage root: `config/security`.
- Token model:
  - Opaque bearer token.
  - Server persists token hash only.
  - Token hash secret is sensitive; never commit or log it.
- Thin-client model:
  - `secureFetch` adds `Authorization: Bearer` when token is present.
  - Token is persisted via `pairedDeviceTokenStore`.
  - Current browser storage uses localStorage for LAN convenience and is not hostile-browser hardened.
- Route policy model:
  - Centralized API route policy table.
  - Unknown `/api/*` routes are denied with `security.route-policy-missing`.
- Error mapping:
  - Preserve HTTP status and canonical security error code at client boundaries.
- Current limitations:
  - no OAuth
  - no mTLS
  - no external TLS termination mode
  - no encryption-at-rest
  - no public-internet hardening
  - no full admin device-management UI
  - rate limiting, audit subsystem, and resource-level storage authorization remain follow-up work

## Security domains

Identity/authentication, authorization/policy, transport security, storage security, secrets/credentials, audit logging, input hardening, runtime/process isolation, supply-chain/model/plugin security, and privacy/data governance.

## Layered enforcement model

- Transport boundary: authenticate, coarse scopes, reject malformed/oversized inputs, apply headers/rate limits.
- Application boundary: resource authorization, actor-aware use-case policy, audit events.
- Adapter boundary: path containment, credential storage, optional encryption, runtime hardening, redaction.
- Host composition: mode selection, adapter wiring, credential/security config.

## Route/storage/secret/audit principles

- Route policy should be centralized, not scattered across handlers.
- Storage keys are opaque; path containment is required in filesystem adapters.
- Secrets/credentials are not ordinary settings; never log authorization headers.
- Audit logs are separate from normal diagnostics.

## Dependency rules

- Security contracts can be used broadly.
- Security adapters are outer-layer implementations and must not be imported by domain/application.
- UI must not import server security adapters.

## What not to do

- Do not claim security is fully implemented already.
- Do not claim HTTPS + LAN token is sufficient for public internet production exposure.
- Do not claim bearer tokens encrypt traffic.
- Do not move all feature code into `security/` folders.

## Dev enforcement override (local testing only)

- `AI_SYSTEM_BUILDER_SECURITY_MODE` remains startup-owned and controls listener/transport posture.
- `AI_SYSTEM_BUILDER_DEV_SECURITY_TOGGLE_ENABLED=true` enables a dev-only in-memory enforcement override **only** when startup mode is `disabled-dev`.
- The override toggles middleware auth behavior (`disabled-dev` or `lan-token-enforced`) for local testing.
- It does not convert HTTP to HTTPS on a running server and is not production security.

- Dev HTTPS testing in `disabled-dev` is supported via `AI_SYSTEM_BUILDER_HTTPS_ENABLED=true` plus TLS cert/key env vars.
- Thin-client Vite dev HTTPS is separate from server API HTTPS and is optional/dev-only:
  - `AI_SYSTEM_BUILDER_THIN_CLIENT_HTTPS_ENABLED=true`
  - Explicit listener certificate files can be supplied with
    `AI_SYSTEM_BUILDER_THIN_CLIENT_TLS_CERT_PATH=/path/to/cert.pem` and
    `AI_SYSTEM_BUILDER_THIN_CLIENT_TLS_KEY_PATH=/path/to/key.pem`.
  - If no explicit thin-client cert/key paths are supplied, `AI_SYSTEM_BUILDER_TLS_CERT_MODE=auto-self-signed`
    or `auto-local-ca` generates/reuses dev listener certificate material for Vite.
  - Default remains HTTP thin-client at `http://localhost:5173`.
  - Thin-client HTTPS does not change server API HTTPS mode; proxy target still follows server HTTPS env (`AI_SYSTEM_BUILDER_HTTPS_ENABLED` / `AI_SYSTEM_BUILDER_SECURITY_MODE`).
- Startup transport mode is restart-bound; dev auth enforcement toggle is runtime-only and does not live-switch HTTP/HTTPS.


## TLS certificate UX notes

- Default `dev:server` is `disabled-dev` over HTTP with no auth.
- HTTPS dev transport can be enabled with `AI_SYSTEM_BUILDER_HTTPS_ENABLED=true` and `AI_SYSTEM_BUILDER_TLS_CERT_MODE=auto-self-signed`.
- `auto-self-signed` generates/reuses certificate material for transport but may still produce browser trust warnings.
- `auto-local-ca` is supported for local/dev/LAN testing with manual CA trust installation.
- Listener mode changes (HTTP/HTTPS) require restart; dev auth enforcement toggle is runtime auth-only.


No automatic trust-store installation is performed. Trust installation is manual; browser/mobile trust limitations apply. Do not commit private keys or SERVER_TOKEN_HASH_SECRET.

## Runtime readiness API security

- Runtime-backed feature-start guard failures may include `capabilityId`, readiness `status`, safe `summary`, `reason.code`, `reason.category`, and `recommendedActions`; they must not include stack traces, paths, env values, secrets, tokens, command lines, raw adapter payloads, or raw exception messages.
- Asset Kernel application mapping/view/facade services use a centralized application-owned safe metadata/view sanitizer; internal host registry diagnostics must not expose filesystem paths, secrets, raw payloads, or seed catalog content. Resource-backed view provider diagnostics are structured application-port results and must be sanitized before leaving application services; unsupported/not-wired providers report safe info diagnostics instead of raw failures.
- Artifact/document resource-backed view providers must treat artifact bytes, document text, local paths, storage roots, storage keys that look path-like, raw provider payloads, command lines, env values, stack traces, secrets/tokens/auth values, blobs, and base64 values as non-exposable. Document-like detection is metadata-only and must not inspect file contents.
- Image/generated-output resource-backed view providers must also omit local paths, storage/runtime roots, temp/cache paths, data URLs, bytes/blobs/base64, raw workflow/ComfyUI/provider payloads, command lines, env values, stack traces, secrets/tokens/auth values, and prompt/negative-prompt text by default. Generated-output views must remain clearly unfinalized/unregistered and must not query runtime task state to discover outputs.
- Resource-backed provider detail reads must not weaken that posture: direct descriptor reads are allowed only through safe application ports and reversible safe view ids, while list fallback reads must be explicitly bounded/diagnosed. Provider and facade output must also omit request/task ids unless explicitly approved by a future phase.
- Runtime readiness API and IPC internal failures must remain sanitized: no stack traces, filesystem/temp paths, secrets, tokens, raw environment values, command lines, raw adapter details, raw provider exception messages, HTTP internals, or process internals in response payloads. Readiness provider failures should surface as sanitized failed capability statuses, and Runtime Task Registry list delegate failures should surface as sanitized warnings. Runtime/model/image-generation API and IPC adapters should use generic messages for unexpected internal failures while preserving safe structured runtime-unavailable guard details.
- Readiness reads are informational and must not mutate runtime state by starting, installing, repairing, or probing heavy sidecars.
## Phase 2C Prompt 2: read-only Asset Registry server API foundation

Phase 2C begins by exposing only a narrow, read-only server API foundation for Asset Registry definition reads. The server routes wrap an application-owned Asset Registry definition read port/read facade and must not receive persistence adapters, host composition helpers, mutation use cases, built-in seeding services, or local repositories.

The initial `/api/assets` surface is GET-only for asset definition list/detail/version reads. It must not scan resources, read bytes, call runtimes, call providers, seed built-ins, import/finalize/register assets, or execute workflows. Later Phase 2C prompts add matching read-only desktop IPC/preload and desktop/thin-client Asset Library clients/pages over the same definitions-only read surface.

## Phase 2C Prompt 3: read-only Asset Registry desktop IPC/preload foundation

Desktop Asset Registry IPC/preload errors must remain sanitized and generic for unexpected failures. The read-only definition list/read/version-read wrappers trust application facade payload sanitization but must not add raw exception messages, stack traces, filesystem/temp/runtime/storage paths, secrets/tokens/auth headers/env values, command lines, provider payloads, bytes, or resource content to IPC/preload responses.

Phase 2C public Asset Registry transports also sanitize preload/API/IPC-visible payloads at the boundary. Unsafe local paths, storage/runtime root names, bearer tokens, tokens, secrets, API keys, passwords, stack traces, commands, base64/blob content, raw provider payloads, and raw exception messages must not appear in validation, not-found, internal, or successful read responses.

## Phase 2C Prompt 4: Asset Library UI-client sanitization

Shared Asset Library UI mappers and desktop/thin-client read clients must defensively re-sanitize transport/preload payloads before exposing UI-facing card/detail models. UI-client errors preserve safe codes, request IDs, correlation IDs, and HTTP status when available, but internal failures stay generic and must not surface filesystem paths, tokens/secrets/API keys, stack traces, command lines, raw provider payloads, blobs, base64 data, or raw exception messages.

Shared Asset Library UI mappers must also avoid silently turning invalid or missing canonical asset type, family, or lifecycle status payloads into valid-looking Asset Kernel values. Render unknown/not-specified display labels instead, while continuing to sanitize unsafe metadata, diagnostics, validation errors, paths, tokens, commands, stack traces, and encoded content.

## Phase 2C Prompt 5: desktop Asset Library page sanitization

The desktop read-only Asset Library page renders only shared UI-facing read models from the preload-backed client. List cards avoid raw metadata, detail advanced sections are collapsed by default, safe metadata is rendered only after shared mapper sanitization, and user-visible errors remain generic/safe. The page must not expose asset seeding, mutation, import, finalization, registration, resource scanning, runtime/provider execution, raw payloads, local paths, secrets, command lines, bytes, blobs, base64 content, or stack traces.

## Phase 2C Prompt 6: thin-client Asset Library page sanitization

The thin-client read-only Asset Library page renders only shared UI-facing read models from the GET-only server API client. List cards avoid raw metadata, detail advanced sections are collapsed by default, safe metadata is rendered only after shared mapper sanitization, and user-visible errors remain generic/safe. The page must not expose asset seeding, mutation, import, finalization, registration, resource scanning, runtime/provider execution, raw payloads, local paths, secrets, tokens, command lines, bytes, blobs, base64 content, or stack traces.

## Phase 2C Prompt 7: Asset Library advanced detail panels

Desktop and thin-client advanced Asset Library detail panels remain read-only and render only sanitized UI read models. Validation summaries are shown only when already present or explicitly requested through the existing bounded read option; normal selection must not request validation. Safe metadata must omit unsafe values entirely, including local/temp paths, secrets, tokens, auth headers, env values, command lines, stack traces, raw provider payloads, bytes, blobs, and base64 content.

Phase 2C Prompt 8 extends the same sanitization baseline across API, IPC, preload/client, and UI regression tests. Unsafe values must be absent from payloads and rendered output, not hidden with CSS. Treat standalone `password`, `secret`, `token`, `auth`, `base64`, `stack trace`, `command`, `process.env`, local paths, bearer tokens, API keys, raw provider payloads, and bytes/blobs as unsafe.
