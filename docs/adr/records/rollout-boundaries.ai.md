# AI Companion: ADR System Rollout Boundaries and Future Expansion Areas

## Scope and Intent

This note closes the initial ADR system rollout by defining included scope, explicit boundaries, and safe expansion paths so humans and assistants can treat ADRs as durable decision memory.

## Initial Rollout Scope (What Is Included)

The initial ADR system rollout is intentionally bounded to durable architecture decision governance:

- Canonical ADR record set in `docs/adr/records/` (`ADR-001` through `ADR-006` accepted baseline).
- Canonical discovery index in `docs/adr/records/adr-registry.json`.
- ADR governance rules for thresholds, lifecycle states, review tiers, and supersession in `docs/adr/README.ai.md` and `docs/adr/records/README.ai.md`.
- ADR writing-quality guidance in `docs/adr/records/authoring-guide.ai.md`.
- Validation guardrails via `npm run docs:validate:adr` and ADR guardrail tests in `dev/tests`.
- Cross-linking expectations to keep ADRs connected to architecture and contributor guidance docs.

## Known Gaps and Explicit Non-Goals for Initial Rollout

This rollout is useful without requiring exhaustive architecture decision backfill:

- ADR coverage is not exhaustive across every subsystem, host, or implementation seam.
- Historical decisions are not fully backfilled into ADR format.
- Implementation-local choices remain in architecture/contributor docs instead of being forced into ADRs.
- The rollout does not remove all future architecture debate; it narrows debate to new or revised durable boundaries.

## Future ADR Expansion Areas

Add ADRs as new durable boundaries appear, including areas like:

1. Cross-host reliability and failure-recovery authority boundaries.
2. Eventing, projection freshness, and cross-surface consistency guarantees.
3. Data lifecycle posture (retention, archival, and recovery) when long-lived architecture direction is set.
4. Multi-provider model/runtime strategy and portability boundaries.
5. Deployment topology and operational isolation guarantees when those constraints become architecture authority.

## Responsible ADR Library Extension Rules

When extending ADR coverage:

1. Use ADRs for durable architecture authority; use `docs/architecture/` and `docs/contributors/` for implementation guidance that does not change decision boundaries.
2. Publish a new ADR when direction changes; do not overwrite historical ADR decisions in place.
3. Keep `.md` and `.ai.md` variants aligned and update `docs/adr/records/adr-registry.json` in the same change.
4. Keep supersession links bi-directional when replacing or narrowing prior ADR authority.
5. Run `npm run docs:validate:adr` before merge.

## Definition of Complete for Initial ADR Rollout

Feature 3 ADR rollout is complete when ADR records, discovery registry, validation guardrails, and contributor routing docs are present and usable.

Completeness for this rollout does not require exhaustive ADR capture before the system is reliable for ongoing architecture work.
