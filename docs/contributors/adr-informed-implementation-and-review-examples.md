# ADR-Informed Implementation and Review Examples

## Purpose

Show how contributors and AI assistants should use ADRs as active design constraints during implementation, review, refactor planning, and architecture discussion work.

## Use This Guide When

- A task touches architecture-sensitive boundaries in `src/domain`, `src/application`, `src/hosts`, `src/infrastructure`, or cross-studio UI contracts.
- A change request proposes "simpler" shortcuts that may bypass accepted platform decisions.
- You need to separate what is already decided (ADR authority) from what remains implementation-local.

## ADRs To Check First

- `docs/adr/records/adr-001-single-authoritative-control-plane.md`
- `docs/adr/records/adr-002-workspace-centered-tenancy-and-resource-ownership.md`
- `docs/adr/records/adr-003-storage-as-managed-platform-resource.md`
- `docs/adr/records/adr-004-studios-as-views-over-shared-system-and-asset-model.md`
- `docs/adr/records/adr-005-trust-identity-and-security-boundary-enforcement.md`
- `docs/adr/records/adr-006-policy-aware-scheduling-and-controlled-execution.md`

## Settled Decisions vs Open Implementation Details

Treat ADR decisions as settled constraints. Optimize within them unless a new ADR is explicitly proposed.

| Topic | Settled Decision (Do Not Re-Decide In Story Work) | Open Implementation Details (Can Be Chosen Per Story) |
| --- | --- | --- |
| Control-plane writes | Host-local or UI-local mutation authority is not allowed (ADR-001). | How a use case surfaces errors, telemetry detail level, and adapter-level retry backoff values. |
| Workspace tenancy | Workspace is the tenancy/ownership root (ADR-002). | Query optimization, projection shape, and pagination strategy for a workspace-scoped list API. |
| Storage access | Storage is a managed platform capability, not direct path contracts (ADR-003). | Storage provider adapter internals and cache invalidation strategy behind existing ports. |
| Studio modeling | Studios are views over shared model contracts (ADR-004). | Studio UX composition, panel layout, and local editor ergonomics that preserve shared contracts. |
| Security boundaries | Auth/trust/authz boundaries fail closed (ADR-005). | Credential refresh timing, redaction wording, and diagnostics detail for denied actions. |
| Scheduling/execution | Scheduling stays policy-aware and centrally controlled (ADR-006). | Queue prioritization heuristics or retry jitter values inside approved policy seams. |

## Example 1: Implementation Prompt (Run Scheduling Change)

Scenario:
- You are updating run queue visibility and policy explanation surfaces in `src/application/runs` and `src/ui/services`.

How ADRs shape the implementation prompt:
- Anchor to ADR-006 first: do not move scheduling policy decisions into UI service helpers.
- Anchor to ADR-001 second: mutation authority remains in authoritative host/application use cases.
- Keep request scoped to policy explanation and read-model improvements, not control-plane redesign.

Prompt scaffold:
```text
Implement Story X for run scheduling visibility in AI Loom Studio.
Before coding, treat these as settled:
- ADR-006 policy-aware scheduling and controlled execution is authoritative.
- ADR-001 authoritative control-plane ownership is non-negotiable.

Allowed scope:
- Improve policy explanation DTOs and UI read-model rendering.
- Add tests under src/application/runs/tests and src/ui/services/tests.

Out of scope unless proposing a new ADR:
- New non-authoritative scheduling paths.
- UI-local execution dispatch.
```

## Example 2: Review Checklist (Storage Shortcut Proposal)

Scenario:
- A PR adds direct filesystem path writes from `src/ui/services` to speed up generated-result persistence.

Review approach:
1. Check ADR-003: direct path contracts in feature slices violate managed storage direction.
2. Check ADR-004: studio services should consume shared contracts, not become persistence authorities.
3. Mark as architecture regression even if tests pass.

Review comment pattern:
```text
This change conflicts with ADR-003 and ADR-004.
- ADR-003 keeps storage behind managed platform ports.
- ADR-004 keeps studio/UI surfaces as views over shared system contracts.

Please route persistence through existing application/storage ports and keep UI service logic adapter-level only.
If you believe direct paths are now required, open a new ADR instead of silently overriding settled decisions.
```

## Example 3: Refactor Plan (Host Startup Simplification)

Scenario:
- You want to refactor startup composition across `src/hosts`, `electron/main`, and runtime orchestration glue.

ADR-informed refactor framing:
- ADR-001 settles control-plane authority separation across hosts.
- ADR-005 settles security boundary sequencing (fail closed, auth/trust gates first).
- Refactor should reduce duplication while preserving authority and gate order.

Safe refactor plan shape:
1. Extract shared bootstrap helpers that do not perform authoritative writes.
2. Preserve auth-first and post-login boundaries in host entrypoints.
3. Keep guardrails aligned in `dev/tests/HostCompositionArchitectureGuardrails.test.ts`.
4. Update architecture docs if contracts are clarified, not changed.

Escalate to new ADR when:
- Refactor proposes a new authority root, trust boundary collapse, or host role inversion.

## Example 4: Design Discussion (Studio-Specific Data Model Request)

Scenario:
- Design discussion suggests adding a studio-local asset identity model to speed editor-only workflows.

How to run the discussion with ADR context:
1. Start from ADR-004: studio-local authority models are not default.
2. Check ADR-002 for workspace ownership implications.
3. Ask whether the need can be met with shared model extensions and studio view adapters.

Discussion outcome template:
- Settled decisions acknowledged:
  - ADR-004 shared model authority.
  - ADR-002 workspace ownership boundary.
- Open design questions:
  - Which shared asset fields are missing for this workflow?
  - What adapter/read-model changes are needed in studio shell?
  - Which tests prove shared-contract compatibility?
- Decision:
  - Proceed without new ADR if changes stay implementation-local.
  - Draft ADR only if a new durable model-authority rule is required.

## Routine vs Heightened ADR Review Lanes

Use ADR `review_tier` to keep governance strong without making every ADR heavy:

| Review Tier | Typical ADR Scope | Minimum Review Expectation | Broader Architecture Review Before Acceptance/Supersession |
| --- | --- | --- | --- |
| `routine` | Architectural direction that does not alter high-risk boundaries. | One architecture maintainer review plus normal ADR PR discussion. | Optional; use only when cross-domain impact is unclear. |
| `heightened` | Security/trust boundaries, runtime control authority, tenancy/isolation semantics, or supersession of those decisions. | Platform architecture owner + impacted domain owner, plus explicit `## Review Expectations` in ADR body. | Required when boundaries, authority, or isolation guarantees change. |

## Quick ADR Gate Before Merge

1. Did the change preserve all relevant accepted ADR constraints?
2. Did review comments distinguish settled decisions from open implementation details?
3. Did tests cover behavior inside the existing architecture boundary?
4. Were docs updated where contracts or contributor guidance changed?
5. If a settled decision was challenged, was a new ADR requested instead of ad hoc code drift?

## Related Documentation

- `docs/adr/README.md`
- `docs/adr/records/README.md`
- `docs/architecture/README.md`
- `docs/context/packs/architecture-core.pack.md`
- `docs/contributors/context-engineering-system-guide.md`
