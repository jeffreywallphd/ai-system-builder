# ADR System Rollout Boundaries and Future Expansion Areas

## Scope and Intent

This note closes the initial ADR system rollout by defining what is included now, what remains out of scope for this release, and how contributors should extend ADR coverage without reopening settled decisions.

## Initial Rollout Scope (What Is Included)

The initial ADR system rollout is intentionally bounded to durable decision memory and governance essentials:

- Canonical ADR record library in `docs/adr/records/` with accepted baseline decisions (`ADR-001` through `ADR-006`).
- Canonical fast-discovery index in `docs/adr/records/adr-registry.json`.
- Governance rules for ADR thresholds, lifecycle status, review tiers, and supersession handling in `docs/adr/README.md` and `docs/adr/records/README.md`.
- ADR authoring quality guidance in `docs/adr/records/authoring-guide.md`.
- Validation guardrails via `npm run docs:validate:adr` and ADR guardrail tests under `dev/tests`.
- Cross-linking expectations so ADRs remain connected to architecture docs in `docs/architecture/` and contributor guidance in `docs/contributors/`.

## Known Gaps and Explicit Non-Goals for Initial Rollout

This release does not require exhaustive decision capture before the ADR system is useful:

- The ADR set is not exhaustive across every subsystem, host, or implementation seam.
- Historical architecture work is not fully backfilled into ADR format.
- Story-level and implementation-local choices remain documented in architecture or contributor docs, not forced into ADRs.
- The rollout does not attempt to eliminate all future architecture debates; it narrows debate to genuinely new or revised decision boundaries.

## Future ADR Expansion Areas

Future ADRs should be added as durable decision boundaries emerge, including areas such as:

1. Cross-host reliability and failure-recovery authority boundaries.
2. Eventing, projection freshness, and consistency guarantees across runtime surfaces.
3. Data lifecycle posture (retention, archival, and recovery strategy) where architecture direction is not yet fixed.
4. Multi-provider model/runtime strategy and portability boundaries.
5. Deployment topology and operational isolation guarantees when these become durable platform constraints.

## Responsible ADR Library Extension Rules

When extending the ADR library:

1. Use ADRs for durable architecture decisions; use `docs/architecture/` and `docs/contributors/` for implementation guidance that does not change decision authority.
2. Create a new ADR when direction changes; do not rewrite historical ADR decisions in place.
3. Keep `.md` and `.ai.md` variants aligned and update `docs/adr/records/adr-registry.json` in the same change.
4. Keep supersession links bi-directional when replacing or narrowing prior ADR authority.
5. Run `npm run docs:validate:adr` before merge.

## Definition of Complete for Initial ADR Rollout

Feature 3 ADR rollout is considered complete when the current ADR library, registry, validation guardrails, and contributor routing guidance are in place and usable.

Completeness for this rollout does not require exhaustive ADR coverage of every architectural topic before teams can rely on the system.
