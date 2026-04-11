---
title: Architecture Domainization Rollout Boundaries and Follow-On Work
doc_type: architecture-reference
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - docs/architecture/README.md
  - docs/architecture/domains
  - docs/architecture/architecture-domain-migration-inventory.md
  - docs/architecture/architecture-migration-sequence-and-priority.md
  - docs/architecture/architecture-supersession-and-retirement-governance.md
  - dev/tests/ArchitectureDomainizationRolloutBoundariesGuardrails.test.ts
---

# Architecture Domainization Rollout Boundaries and Follow-On Work

## Scope and Intent

This note closes the initial architecture domainization rollout by defining what is complete now, what is intentionally deferred, and where remaining architecture refactor work should continue.

## Initial Rollout Scope (What Is Included)

Treat this rollout as complete when all of the following are true:

- `docs/architecture/domains/` contains the canonical domain folder model with overview and reference-index patterns.
- Architecture routing and governance anchors are active and linked: taxonomy, migration inventory, migration sequence, scope boundaries, cross-linking rules, and supersession governance.
- Legacy flat documents are governed by explicit coexistence/supersession states instead of ad hoc migration behavior.
- Domain overviews and references are materially improved for navigation and retrieval versus prior flat, mixed-scope architecture patterns.
- Guardrail validation and tests enforce structure, required links, and `.md`/`.ai.md` companion parity.

## Explicit Non-Goals for Initial Rollout (What Is Not Included Yet)

This initial rollout is intentionally bounded and not exhaustive. It does not require:

- Migration of every remaining flat architecture document into a domain reference immediately.
- Elimination of all legacy link stubs in the same release as domainization.
- Perfectly uniform depth or style across every domain reference in one pass.
- Exhaustive cross-linking from every neighboring document type to every architecture artifact.
- Conversion of all historical architecture narrative into baseline artifacts in this story.

## Known Remaining Architecture Refactor Work

Known residual work is expected and should be tracked as follow-on stories or maintenance:

- Complete migration of active flat references that remain intentionally pending.
- Continue retiring legacy stubs only after inbound links and guardrails confirm safe removal.
- Split additional oversized mixed-scope references when they reintroduce scope blending.
- Improve reference-level coverage where domain overviews already exist but contract detail remains thin.
- Tighten cross-document linking quality as ADR, context-pack, contributor, and operations routers evolve.

## Definition of Complete for Initial Domainization Rollout

The architecture domainization feature should be considered complete for this initial rollout when:

- In-scope domain structure and governance artifacts are present, canonical, and discoverable.
- Contributors can navigate from architecture routers to the correct domain overview/reference authority without ambiguity.
- Remaining refactor work is explicitly documented as follow-on work rather than hidden migration debt.
- The architecture documentation system is materially improved and usable now, even though later refinements remain.

Completeness for this rollout does not require exhaustive migration of every architecture artifact.

## Follow-On Work (Prioritized)

1. Finish residual flat-to-domain migrations:
   - Prioritize high-traffic legacy documents still marked as active flat references.
   - Keep one canonical authority per contract while migrating.
2. Continue supersession cleanup safely:
   - Remove stubs only when inbound references have migrated and tests stay green.
   - Preserve baseline history when retiring obsolete authority paths.
3. Raise reference quality consistency:
   - Expand thin reference indexes into durable contract-focused references.
   - Reduce duplication across neighboring domain references with canonical link-outs.
4. Strengthen governance and validation depth:
   - Add guardrails for stale links, missing reverse-links, and drift between related routers.
   - Expand test coverage where migration complexity or ambiguity remains highest.

## Contributor Extension Rules for Remaining Work

- Start from `docs/architecture/README.md` and the target domain `overview.md` boundary before editing references.
- Apply migration ordering from `architecture-migration-sequence-and-priority.md` and supersession rules from `architecture-supersession-and-retirement-governance.md`.
- Keep `.md` and `.ai.md` companions aligned in the same change.
- Preserve explicit scope boundaries: architecture contracts stay in `docs/architecture/`; workflow/runbook/history content links out to canonical locations.

## Related Documentation

- [Architecture Documentation Router](./README.md)
- [Architecture Domain Folders](./domains/README.md)
- [Architecture Domain Migration Inventory](./architecture-domain-migration-inventory.md)
- [Architecture Migration Sequence and Priority Order](./architecture-migration-sequence-and-priority.md)
- [Architecture Supersession and Retirement Governance](./architecture-supersession-and-retirement-governance.md)
- [Architecture Document Scope Boundaries](./architecture-document-scope-boundaries.md)
- [Architecture Domain Cross-Linking Rules](./architecture-domain-cross-linking-rules.md)
