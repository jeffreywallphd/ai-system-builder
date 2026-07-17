# System Build and Release

- Status: current
- Implementation: System Builder persistence and builds remain increment-gated until their exit evidence passes
- Related decisions: ADR-0020, ADR-0021, ADR-0022, ADR-0023, ADR-0024, ADR-0029, ADR-0030, ADR-0033, ADR-0034
- Verification: `docs/architecture/architecture-verification.md`

## Purpose

This architecture defines the path from a workspace-owned design to an immutable, evidence-backed release that can be previewed or deployed without conflating design, build, release, deployment, and runtime state.

## Lifecycle separation

| Family                | Responsibility                                                       | Mutable?                  |
| --------------------- | -------------------------------------------------------------------- | ------------------------- |
| `SystemBuilderRecord` | identity, name, current revision pointer, archive state              | revisioned                |
| `SystemRevision`      | exact Asset Kernel composition snapshot and design diagnostics       | immutable                 |
| `SystemBuild`         | one attempt to validate/materialize/test a frozen input set          | append-only status/events |
| `SystemRelease`       | content-addressed bundles, lock, compatibility, provenance, evidence | immutable                 |
| `SystemDeployment`    | activation target, rollout/rollback, health                          | operational               |
| execution session/run | approved interaction and runtime progress/results                    | operational               |

Design changes create revisions. Build retries create attempts. A successful changed build creates a release. No operation mutates an old revision or release.

## Deterministic build input

A build lock contains exact digests/versions for:

- system revision and composition;
- effective asset definitions;
- selected implementation releases/facets;
- foundation and imported package versions;
- deployment profile and host/runtime API targets;
- configuration and schema versions;
- policy compiler and workflow interpreter versions;
- build toolchain and dependency lock;
- required migration baseline.

The lock excludes credentials, raw paths, environment secrets, provider payloads, and user-private runtime content.

## Build pipeline

1. Freeze and normalize the requested system revision.
2. Validate asset definitions, configuration, ports, bindings, cardinality, cycles, and dependencies.
3. Compile platform and composed security policy; reject incomplete or weakening policy.
4. Resolve one compatible, permitted implementation facet per required asset.
5. Evaluate deployment, runtime, storage, model/provider, secret-reference, quota, and migration readiness.
6. Materialize deterministic UI route/shell, logic/workflow, data schema/migration, and configuration inputs.
7. Build in the qualified isolated builder.
8. Run contract, unit, integration, accessibility, security, and reference tests required by the composition.
9. Produce digests, SBOM, provenance, compatibility manifest, bounded evidence, and reproducibility result.
10. Require an authorized release approval and persist an immutable release.

Partial outputs remain quarantined and are deleted or retained as failed-build evidence according to policy. They never become active release content.

## Security and workflow compilation

Composed policy is the intersection of platform, organization, system, and asset permissions. A composition can narrow but not widen the upstream authority. Missing required authorization, isolation, masking, audit, or approval declarations block the build.

The initial workflow language is finite and typed. Its compiler proves action availability, type-compatible mappings, bounded branches, no cycles, and declared error paths. Runtime execution invokes only capability broker actions and records each step. General shell or dynamic-code workflow nodes are unsupported.

## Deployment profiles

- Local desktop: SQLite metadata, desktop artifact storage, trusted built-ins and qualified constrained local sandbox.
- Campus/corporate: PostgreSQL, institution object/filesystem storage, isolated server builders/runners, organization policy.
- Cloud: PostgreSQL, tenant-aligned object storage, ephemeral tenant-isolated builders/runners, managed secrets, quota and audit.
- Thin client: server-owned metadata/build/execution; browser receives only safe read models and sandboxed UI facets.

The same logical release may contain multiple target facets. A target activates only when every required facet and capability is compatible. Unsupported shapes fail before execution.

## UI placement

Systems owns system list, editor, validation, build, releases, and Run & Test. Assets owns Catalog and Studio. Operational deployment/runtime status remains separate from design/build records. Desktop and thin-client render the same safe read models and command outcomes.

## Current implementation status

The repository currently provides a design-time System Builder contract shell plus separate planning/readiness/execution families. CRUD, revisions, editor, build, release, deployment, and generalized workflow behavior remain unavailable until their increment evidence passes.
