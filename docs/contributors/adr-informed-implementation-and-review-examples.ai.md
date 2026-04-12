# AI Companion: ADR-Informed Implementation and Review Examples

## Purpose

Operationalize ADR usage for AI-assisted implementation, review, refactor planning, and architecture discussions in AI Loom Studio.

## Use This Guide When

- Tasks touch architecture-sensitive boundaries in `src/domain`, `src/application`, `src/hosts`, `src/infrastructure`, or cross-studio UI contracts.
- A request proposes shortcuts that might bypass accepted architecture decisions.
- You need to separate settled ADR constraints from story-local implementation choices.

## ADRs To Check First

- `docs/adr/records/adr-001-single-authoritative-control-plane.ai.md`
- `docs/adr/records/adr-002-workspace-centered-tenancy-and-resource-ownership.ai.md`
- `docs/adr/records/adr-003-storage-as-managed-platform-resource.ai.md`
- `docs/adr/records/adr-004-studios-as-views-over-shared-system-and-asset-model.ai.md`
- `docs/adr/records/adr-005-trust-identity-and-security-boundary-enforcement.ai.md`
- `docs/adr/records/adr-006-policy-aware-scheduling-and-controlled-execution.ai.md`

## Settled Decisions vs Open Implementation Details

Treat accepted ADRs as settled architecture authority. Do not re-decide them during normal story implementation.

| Topic | Settled Decision (Do Not Re-Decide In Story Work) | Open Implementation Details (Can Be Chosen Per Story) |
| --- | --- | --- |
| Control-plane writes | Host-local or UI-local mutation authority is disallowed (ADR-001). | Error surface format, telemetry granularity, and adapter retry backoff tuning. |
| Workspace tenancy | Workspace remains tenancy and ownership root (ADR-002). | Projection shape, query optimization, and pagination strategy for workspace-scoped APIs. |
| Storage access | Storage is managed platform capability, not direct path contracts (ADR-003). | Provider-adapter internals and cache invalidation strategy behind existing ports. |
| Studio modeling | Studios remain views over shared model contracts (ADR-004). | Studio UX composition, panel behavior, and editor ergonomics preserving shared contracts. |
| Security boundaries | Auth/trust/authz boundaries fail closed (ADR-005). | Token refresh timing, redaction wording, and diagnostics detail for denied flows. |
| Scheduling/execution | Scheduling remains policy-aware and centrally controlled (ADR-006). | Queue heuristics and retry jitter values within existing policy seams. |

## Example 1: Implementation Prompt (Run Scheduling Change)

Scenario:
- Update run queue visibility and policy explanation behavior in `src/application/runs` and `src/ui/services`.

How ADRs shape the prompt:
- ADR-006 blocks moving scheduling policy decisions into UI helper logic.
- ADR-001 keeps mutation authority in authoritative host/application use cases.
- Scope stays on policy explanation/read-model updates, not control-plane redesign.

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
- PR introduces direct filesystem path writes from `src/ui/services` to speed generated-result persistence.

Review method:
1. Validate against ADR-003: direct path contracts in feature slices violate managed storage direction.
2. Validate against ADR-004: studio/UI surfaces are view/adaptation layers, not persistence authorities.
3. Flag as architecture regression even when tests are green.

Review comment pattern:
```text
This change conflicts with ADR-003 and ADR-004.
- ADR-003 keeps storage behind managed platform ports.
- ADR-004 keeps studio/UI surfaces as views over shared system contracts.

Please route persistence through existing application/storage ports and keep UI service logic adapter-level only.
If direct paths are now required, draft a new ADR instead of overriding settled decisions in code review.
```

## Example 3: Refactor Plan (Host Startup Simplification)

Scenario:
- Refactor startup composition across `src/hosts`, `electron/main`, and runtime composition seams.

ADR-informed framing:
- ADR-001 settles authority separation across hosts.
- ADR-005 settles fail-closed security boundary sequencing.
- Refactor may remove duplication but must preserve authority and gate ordering.

Safe plan shape:
1. Extract shared bootstrap helpers with no authoritative writes.
2. Preserve auth-first and post-login runtime boundaries in entrypoints.
3. Keep `dev/tests/HostCompositionArchitectureGuardrails.test.ts` aligned.
4. Update docs when clarifying contracts, not changing architecture intent.

Escalate to new ADR when:
- Refactor introduces a new authority root, host-role inversion, or trust boundary collapse.

## Example 4: Design Discussion (Studio-Specific Data Model Request)

Scenario:
- Proposal suggests a studio-local asset identity model for editor-only speed.

Discussion flow:
1. Start from ADR-004 shared model authority.
2. Check ADR-002 workspace ownership implications.
3. Prefer shared model extension + studio adapter updates before model-authority divergence.

Discussion outcome template:
- Settled decisions acknowledged:
  - ADR-004 shared model authority.
  - ADR-002 workspace ownership boundary.
- Open design questions:
  - Which shared asset fields are missing?
  - Which studio adapter/read-model updates are needed?
  - Which tests verify shared-contract compatibility?
- Decision:
  - No new ADR if work remains implementation-local.
  - New ADR if durable model-authority rules change.

## Routine vs Heightened ADR Review Lanes

Use ADR `review_tier` to keep governance strong without forcing process-heavy review for every ADR:

| Review Tier | Typical ADR Scope | Minimum Review Expectation | Broader Architecture Review Before Acceptance/Supersession |
| --- | --- | --- | --- |
| `routine` | Architectural direction that does not alter high-risk boundaries. | One architecture maintainer review plus normal ADR PR discussion. | Optional; use only when cross-domain impact is unclear. |
| `heightened` | Security/trust boundaries, runtime control authority, tenancy/isolation semantics, or supersession of those decisions. | Platform architecture owner + impacted domain owner, plus explicit `## Review Expectations` in ADR body. | Required when boundaries, authority, or isolation guarantees change. |

## Quick ADR Gate Before Merge

1. Relevant accepted ADR constraints were preserved.
2. Review distinguishes settled decisions from open implementation details.
3. Tests cover behavior within existing architecture boundaries.
4. Docs are updated when contributor guidance or contracts change.
5. Challenged settled decisions are routed to a new ADR proposal.

## Related Documentation

- `docs/adr/README.ai.md`
- `docs/adr/records/README.ai.md`
- `docs/architecture/README.ai.md`
- `docs/context/packs/architecture-core.pack.ai.md`
- `docs/contributors/context-engineering-system-guide.ai.md`
