# Desktop renderer startup boundary (pre-login vs deferred feature runtime)

## Purpose

This document defines what must be available before sign-in (`pre-login`) versus what is intentionally deferred until post-login runtime warmup (`not-needed-for-pre-login`).

## Pre-login renderer startup (required)

The preload bridge must expose only the minimum runtime required to restore/authenticate a session and render sign-in routes:

- `auth.bootstrap` runtime/bootstrap context
- `auth.storage` key-value storage bridge
- `auth.secrets` optional secrets bridge
- `auth.connectivity` connectivity bridge
- `auth.runtime` deferred-runtime status and warmup trigger helpers

These capabilities are composed as the auth bootstrap surface and are available immediately.

## Not-needed-for-pre-login (deferred feature runtime)

The following are feature bridges and should remain outside pre-login critical-path requirements:

- workflows
- executionRuns
- workflowRunSummaries
- modelFiles
- canonicalAssets
- studioShell
- registry
- agents

They are grouped under the `features` namespace and guarded by deferred runtime availability checks.

## Composition contract

Preload composes a desktop bridge with two explicit namespaces:

- `auth`: pre-login bootstrap capabilities
- `features`: deferred/post-login capabilities

Legacy root aliases continue to be exposed for compatibility, but the architectural boundary is represented by the namespace split and by startup-contract tests.

## Session restore startup optimization

Renderer identity session restore now uses `/api/v1/identity/session/context` as the authoritative bootstrap request and no longer performs a separate preflight `/api/v1/identity/session` request on the success path. This removes one network round-trip from pre-login bootstrap while preserving invalid-session handling via actor-context response errors.

## Follow-up work to further improve startup time

1. **Reduce synchronous preload IPC usage**
   - Evaluate replacing sync status probes with async or cached startup payloads to reduce renderer thread blocking.
2. **Lazy feature bridge initialization**
   - Materialize deferred bridge wrappers on first feature access rather than constructing all wrappers during preload startup.
3. **Bootstrap request consolidation**
   - Consider collapsing renderer bootstrap `/session` + `/session/context` into one endpoint for session-restore path.
4. **Endpoint-level timing telemetry**
   - Add duration histograms for `/identity/session/context` sub-steps (workspace lookup, trusted-device lookup) to target server-side optimizations.
