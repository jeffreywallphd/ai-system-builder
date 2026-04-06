# Shared Mounted Storage Backend Adapter

This note documents Story 9.2.3 (Feature 9 / Epic 9.2): a production-capable backend adapter for managed shared or network-mounted storage.

## Canonical artifacts

- `src/infrastructure/storage/shared/ServerManagedSharedStorageBackendAdapter.ts`
- `src/infrastructure/storage/shared/index.ts`
- `src/infrastructure/storage/shared/tests/ServerManagedSharedStorageBackendAdapter.test.ts`

## Scope and intent

- Implement a concrete adapter for `network-share` managed storage instances.
- Keep shared mount mechanics server-owned through typed target configuration, not caller-supplied path payloads.
- Provide explicit provisioning/binding validation outcomes for reachability, workspace scope, permissions, and compatibility constraints.
- Surface target capability differences through typed capability snapshots and stable reason codes.

## Adapter behavior

`ServerManagedSharedStorageBackendAdapter` implements:

- `requestStorageProvisioning(...)`
  - supports `create`, `activate`, `deactivate`, and `replication-sync` flows for shared storage binding validation.
  - validates target resolution, workspace access, binding reachability, permissions, and target compatibility.
  - emits explicit provisioning receipts with stable shared reason codes:
    - `shared-backend-unsupported`
    - `shared-target-unspecified`
    - `shared-target-unknown`
    - `shared-target-workspace-not-allowed`
    - `shared-binding-missing`
    - `shared-binding-path-conflict`
    - `shared-binding-permission-denied`
    - `shared-compatibility-mismatch`
    - `shared-binding-validated`
    - `shared-binding-created`
    - `shared-replication-unsupported`
    - `shared-filesystem-failure`
- `inspectStorageBackendCapabilities(...)`
  - reports backend-level posture and configured target metadata for `network-share` support.
- `inspectStorageInstanceCapabilities(...)`
  - resolves instance target binding and reports target-specific capability posture plus health notes.

## Server-known shared target model

The adapter is configured through `SharedStorageBackendConfiguration`:

- `targets`: server-owned shared target definitions (id, path, workspace scope, path strategy, compatibility profile)
- `targetLabelKey`: policy label key used to bind storage instances to server-known target ids
- optional workspace default target map (`defaultTargetIdByWorkspace`)
- optional backend binding reference prefix

Each target supports typed compatibility metadata:

- lifecycle/read posture flags (`supportsReadOnlyActive`, cross-workspace read support)
- replication support and optional minimum async sync cadence
- optional max object-size limit
- capability tags for diagnostic/inspection notes

No raw mount path input is accepted through application-facing storage commands.

## Binding and validation model

- Storage instance binding target is resolved from policy label or workspace default mapping.
- Physical binding path is derived by adapter policy (`workspace-storage`, `workspace-only`, or `none` strategy).
- Provisioning validates binding path existence/directory shape and runtime read/write access.
- Optional target policy can create missing binding directories when allowed (`createBindingPathIfMissing`).
- Compatibility checks reject unsupported policy/replication combinations before runtime use.

## Contract and limitation notes

- Adapter is authoritative only for `network-share` backend type.
- Mounting/remounting network shares is out of scope; this adapter binds to server-known targets and validates availability.
- Validation messages are explicit but avoid leaking raw host mount paths into application-layer contracts.
- Capability differences are surfaced in typed snapshot fields and structured note prefixes, not ad hoc backend-specific branching in higher layers.

## Test coverage

`ServerManagedSharedStorageBackendAdapter.test.ts` validates:

- successful shared target binding through application provisioning contract
- explicit failure when target binding is missing/unspecified
- unreachable binding path rejection
- permission-denied rejection for write-required storage
- compatibility mismatch handling (policy, replication, size-limit constraints)
- unsupported backend rejection and capability inspection posture
