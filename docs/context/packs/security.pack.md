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

- Runtime readiness API and IPC internal failures must remain sanitized: no stack traces, filesystem/temp paths, secrets, tokens, raw environment values, command lines, raw adapter details, or process internals in response payloads.
- Readiness reads are informational and must not mutate runtime state by starting, installing, repairing, or probing heavy sidecars.
