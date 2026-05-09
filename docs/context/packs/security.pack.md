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
- Dataset/model resource-backed view providers must omit local/model/cache/Hugging Face/checkpoint/validation-report/output/materialization/source paths, raw model configs or provider payloads, commands, env values, raw logs/reports, bytes/blobs/base64, request/task/prompt ids, secrets, tokens, and auth values. Model validation/publishing status can be shown only as already persisted sanitized metadata; validation, publishing, model discovery, dataset preparation, and file reads must not run during view reads.
- External repository object resource-backed view providers must omit access tokens, auth headers, API keys, passwords/secrets, signed or query-bearing URLs, local/cache/storage/runtime paths, Hugging Face cache paths, provider-native raw payloads, command lines, stack traces, env values, object contents, bytes/blobs/base64, and local downloaded content. Provider/repository/revision/object labels may be exposed only after conservative sanitization, and unsafe fields must be removed in application provider output rather than hidden by UI code.
- Phase 3 Review B keeps external repository object paths omitted from public provider/facade output by default. External provider labels, including `local`, `http`, and `custom`, are descriptor metadata only and must not be interpreted as permission to read local files, call HTTP/provider clients, access tokens, browse/check existence, import, localize, publish, register, or read bytes/content.
- Phase 3 Prompt 7 host wiring keeps resource-backed diagnostics sanitized across desktop/server composition. Unsupported/not-wired family diagnostics may identify the safe family/source kind, but must not expose storage roots, runtime roots, local/cache paths, secrets, tokens, auth values, commands, stack traces, raw payloads, bytes, blobs, base64, provider-native errors, or host composition internals.
- Phase 3 Prompt 8 stabilization keeps the same public-read posture: resource-backed view diagnostics and metadata must stay sanitized at provider, facade, API/IPC/preload, and UI boundaries; generated outputs and external objects must be labeled as not registered/imported/finalized, without leaking prompts, paths, tokens, signed URLs, task/request ids, raw payloads, bytes, blobs, base64, or contents.
- Phase 4 Prompt 2 mutation contracts are approval-, actor-, source-identity-, provenance-, and idempotency-aware but remain contracts only. Approval and actor shapes are safe flags/references, not auth sessions or credentials. Source identity and result/failure/provenance shapes must use deterministic non-secret ids/fingerprints and sanitized summaries, never raw filesystem paths, tokens, signed URLs, provider payloads, bytes/base64, prompts, workflow JSON, command lines, stack traces, environment values, HTTP headers, IPC events, or provider-native errors.
- Phase 4 Prompt 3 resource-backed registration keeps that posture in the application layer: registration re-reads the sanitized source view, rejects access flags that imply network, credential, or filesystem writes, stores only safe Asset Kernel metadata/references, and sanitizes source identity, provenance, diagnostics, validation failures, and idempotency context. Generated-output prompts/workflows and external repository paths/tokens remain out of registered instance records.
- Phase 4 Prompt 4 generated-output finalization requires explicit user confirmation and filesystem-write approval, rejects unnecessary network/credential approval by default, and still stores only sanitized Asset Kernel metadata/references. Prompt text, negative prompts, raw workflow/ComfyUI/provider payloads, local/storage/runtime paths, bytes/blobs/base64/data URLs, tokens, command lines, env values, and stack traces must not enter Asset Kernel source identity, provenance, diagnostics, metadata, or failure details.
- Phase 4 Review A keeps those guards first: approval/permission/validation failures return before source reads, duplicate detection, finalization calls, or repository writes. Source identity deduplication keys must stay opaque, and mutation results must not expose safe-looking but sensitive ids such as paths, signed/token URLs, Hugging Face cache/provider refs, prompt/workflow labels, bearer strings, raw payloads, command lines, env values, or stacks.
- Phase 4 Prompt 5 external object import/localization requires explicit user confirmation, matching confirmation kind, network approval, credential-use approval, partial-completion approval, and filesystem-write approval. Import is intentionally conservative for both `remote-reference` and `catalog-registration` until a later public policy can prove narrower transport semantics. Source identity, port requests, provenance, metadata, diagnostics, and partial-failure details must omit tokens, auth headers, signed URLs, query-string credentials, local/cache/storage/runtime paths, raw provider payloads, raw metadata payloads, raw errors/stacks, command lines, environment values, bytes/blob/base64/data URLs, and object contents.
- Phase 4 Prompt 6 centralizes the mutation guard layer and keeps it application-local. Guards validate operation identity, confirmation kind, user approval, required capability flags, actor/initiation metadata, automation-safe limits, and safe request context before any reads or side effects. Source identity, provenance, duplicate diagnostics, and typed failures remain sanitized; public mutation API/IPC/preload/UI exposure remained deferred until the later thin wrapper/UI prompts, and this does not introduce a full RBAC/policy engine.
- Phase 4 Prompt 7 exposes only four approved mutation wrappers through API/IPC/preload. Transports must sanitize malformed payloads, typed mutation failures, and thrown errors before returning envelopes; they must not leak raw errors, stack traces, paths, storage/runtime roots, Hugging Face cache paths, tokens/secrets/auth/session/cookies, signed URLs, provider-native payloads, command lines, env values, bytes/blob/base64/data URLs, prompts, negative prompts, workflow JSON, or resource contents. Application use cases remain the enforcement layer.
- Phase 4 Prompt 8 Asset Library UI actions must render only sanitized action/result text, never raw paths, storage/runtime/cache roots, tokens, signed URLs, raw provider payloads, prompt/workflow JSON, stack traces, command lines, bytes/base64, or resource contents. Advanced diagnostics, when shown, stay collapsed and sanitized.
- Phase 5 Prompt 2 asset pack contracts are manifest-safe and declarative only. Pack manifests, entries, override rules, and resolution diagnostics must not contain local/cache/storage/runtime paths, tokens, auth material, signed URLs, raw provider payloads, resource bytes, blobs/base64/data URLs, prompt text, workflow JSON, model/dataset/image/document contents, command lines, stacks, or environment values. Trust/install status fields are vocabulary, not policy execution or package-manager behavior.
- Phase 5 Prompt 3 application pack catalog services keep the same safety baseline: `system.foundation` is an empty placeholder manifest plus validation/quality gates only. Pack validation and quality gates must reject unsafe metadata, resource contents, raw provider payloads, renderer implementation paths, tokens/secrets/auth material, local paths, prompt/workflow payloads, and install/activation implications. No public import/export/marketplace, seeding/install, resolver execution, persistence, transport, UI, provider/network/storage, or runtime behavior is introduced.
- Phase 5 Prompt 4 keeps that baseline while adding semantic UI structural primitive entries to `system.foundation`. These entries may describe non-goals such as not being renderer components, but they must not contain renderer file paths, implementation library names, CSS class names, local paths, secrets, raw payloads, resource bytes, workflow payloads, runtime/provider calls, public import/export behavior, or install/activation behavior.
- Phase 5 Prompt 5 keeps the same baseline while adding semantic form and field primitive entries to `system.foundation`. These definitions may describe form, field, validation-message, submit, and cancel semantics, but they must remain descriptor-only: no renderer implementation details, validation processing, submission handling, file transfer handling, storage writes, provider/network/runtime calls, public import/export behavior, visual editing, seeding/install behavior, local paths, secrets, raw payloads, resource bytes, or workflow payloads.
- Phase 5 Prompt 6 keeps the same baseline while adding semantic data display, state, and message primitive entries to `system.foundation`. These definitions may describe table/list/detail/status/progress/preview-placeholder and empty/loading/error/success semantics, but they must remain descriptor-only: no renderer implementation details, data-grid implementation, preview rendering, resource reading, data fetching, storage reads, API clients, provider/network/runtime calls, public import/export behavior, visual editing, seeding/install behavior, local paths, secrets, raw payloads, resource bytes, resource content, or workflow payloads.
- Phase 5 Review A makes pack safety checks context-aware without weakening payload safety. Explanatory non-goal language in descriptions, AI context, examples, and guidance may mention avoided behavior, but metadata, path/token/provider/content/payload fields, signed/data URLs, raw prompt/workflow values, execution code, renderer paths/libraries, and runtime/provider/network/storage requirements remain invalid.
- Phase 5 Prompt 8 internal system pack install diagnostics must stay sanitized: no local filesystem paths, stack traces, raw persistence exceptions, tokens/secrets/auth material, provider payloads, resource bytes/base64, command lines, runtime details, or storage roots. The installer validates before save, persists only safe metadata/references, skips conflicts without overwrite, and remains internal with no public API/IPC/preload/UI install surface or host startup auto-seeding.
- Phase 5 Prompt 9 Asset Library pack/source/category display must use sanitized read fields only. UI and read-facade output must omit local/cache/storage/runtime paths, tokens/secrets/auth/session/cookies, signed URLs, query credentials, raw provider payloads, stack traces, command lines, environment values, bytes/blob/base64/data URLs, prompt/negative-prompt text, workflow JSON, and resource contents. Override/resolution metadata is informational only when safe references/summaries already exist and must not imply resolver execution or edit authority.
- Runtime readiness API and IPC internal failures must remain sanitized: no stack traces, filesystem/temp paths, secrets, tokens, raw environment values, command lines, raw adapter details, raw provider exception messages, HTTP internals, or process internals in response payloads. Readiness provider failures should surface as sanitized failed capability statuses, and Runtime Task Registry list delegate failures should surface as sanitized warnings. Runtime/model/image-generation API and IPC adapters should use generic messages for unexpected internal failures while preserving safe structured runtime-unavailable guard details.
- Readiness reads are informational and must not mutate runtime state by starting, installing, repairing, or probing heavy sidecars.
## Phase 2C Prompt 2: read-only Asset Registry server API foundation

Phase 2C begins by exposing only a narrow, read-only server API foundation for Asset Registry definition reads. The server routes wrap an application-owned Asset Registry definition read port/read facade and must not receive persistence adapters, host composition helpers, mutation use cases, built-in seeding services, or local repositories.

The `/api/assets` surface is GET-only for asset definition list/detail/version reads and resource-backed view list/detail reads. It must not scan resources, read bytes, call runtimes, call providers, seed built-ins, import/finalize/register assets, or execute workflows. Desktop IPC/preload and desktop/thin-client Asset Library clients/pages expose the same read-only facade-backed surface.

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
