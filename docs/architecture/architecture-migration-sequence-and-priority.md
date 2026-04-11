---
title: Architecture Migration Sequence and Priority Order
doc_type: architecture-reference
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - docs/architecture/architecture-domain-migration-inventory.md
  - docs/architecture/architecture-domain-migration-inventory.inventory.json
  - docs/architecture/architecture-migration-sequence-and-priority.sequence.json
  - dev/tests/ArchitectureMigrationSequenceGuardrails.test.ts
---

# Architecture Migration Sequence and Priority Order

## Purpose

Define the migration order for domainized architecture docs so contributors improve the highest-value architecture surfaces first, while avoiding ambiguous partial migration states.

## Sequencing Goals

- Prioritize architecture surfaces that control security posture, startup authority, and runtime boundaries.
- Move tightly-coupled mapping units together so domain overviews and references do not drift apart.
- Keep one active authority per contract throughout migration.
- Keep migration batches small enough to review and validate in one story.

## Priority Waves

Use the sequence below as the default migration order. Each wave references mapping IDs from `architecture-domain-migration-inventory.inventory.json`.

| Wave | Priority | Target domains | Mapping IDs | Why this moves first |
| --- | --- | --- | --- | --- |
| `wave-0-router-and-rules` | `P0` | `core-platform-and-composition` | `map-001` | Establishes taxonomy/scope/cross-linking contracts so later waves do not invent local migration styles. |
| `wave-1-security-and-runtime-boundaries` | `P1` | `core-platform-and-composition`, `runtime-host-surfaces`, `identity-trust-and-security` | `map-002`, `map-003`, `map-004`, `map-005`, `map-006`, `map-007`, `map-008` | Highest risk and highest contributor impact: startup/auth gates, trust boundaries, and identity enforcement drive most downstream contracts. |
| `wave-2-storage-and-control-plane-authority` | `P2` | `workspace-storage-and-assets`, `execution-control-plane-and-scheduling` | `map-009`, `map-010`, `map-011`, `map-012`, `map-013` | Run lifecycle and storage/asset authority are next because they depend on trust/runtime boundaries and unblock API stabilization. |
| `wave-3-api-surface-stabilization` | `P3` | `api-and-transport-surfaces` | `map-016`, `map-017` | API authority should follow control-plane/storage migrations so endpoint contracts are aligned to already-migrated domain ownership. |
| `wave-4-studio-composition-alignment` | `P4` | `studio-and-system-composition` | `map-014`, `map-015` | Studio composition references many prior boundaries; migrating it after API/control-plane/storage lowers cross-domain rework. |
| `wave-5-governance-and-historical-cleanup` | `P5` | `deployment-policy-and-audit-governance`, `identity-trust-and-security` plus baseline archive paths | `map-018`, `map-019`, `map-020`, `map-021`, `map-022` | Final wave consolidates governance and archives historical snapshots after active-domain authority paths are stable. |

## Dependency Rules and Gating Criteria

Apply these gates before starting each wave:

1. Dependency gate: all prior wave mappings are migrated or have an explicit deferred decision in the story notes.
2. Authority gate: each migrated contract has one canonical destination and source duplicates are replaced with link stubs.
3. Companion parity gate: `.md` and `.ai.md` are updated together for every moved or split contract.
4. Routing gate: affected `README.md` and `references/README.md` files are updated to point to new canonical locations.
5. Validation gate: guardrail tests pass for affected migration docs and routing references.

## Temporary Coexistence Strategy (Old and New Docs)

During migration, old flat docs and new domain docs can coexist only under the rules below:

1. Use explicit status markers at the top of legacy docs:
   - `legacy-authority`: not yet migrated.
   - `migration-in-progress`: split in progress; include target links.
   - `migrated-link-stub`: legacy path retained only as pointer to canonical domain docs.
   - `historical-baseline`: content moved to `docs/baselines/`.
2. Never keep two active authorities for one contract. If a destination doc becomes canonical, the legacy doc must be converted to a stub in the same batch.
3. Keep legacy stubs short: one-sentence status, canonical links, and optional baseline link.
4. Keep inbound links stable during transition by preserving legacy paths as stubs until referencing routers and context packs are updated.
5. Remove stubs only after inbound references are migrated and tests confirm no required router links still depend on the legacy path.

Canonical governance and machine-readable tracking for this policy live in:
- `docs/architecture/architecture-supersession-and-retirement-governance.md`
- `docs/architecture/architecture-supersession-registry.json`

## Contributor Execution Checklist per Wave

1. Select mappings only from the current wave and confirm dependencies are satisfied.
2. Move or split content into domain `overview.md` and `references/*.md` according to the mapping role.
3. Update `.ai.md` companions in the same commit.
4. Convert replaced legacy docs to stubs, or archive to `docs/baselines/` when the mapping role is `historical-baseline`.
5. Update architecture routers and domain reference indexes.
6. Run guardrail tests and fix routing/section coverage failures before merge.

## Related Documentation

- [Architecture Documentation Router](./README.md)
- [Architecture Domain Migration Inventory](./architecture-domain-migration-inventory.md)
- [Architecture Domain Taxonomy](./architecture-domain-taxonomy.md)
- [Architecture Domain Cross-Linking Rules](./architecture-domain-cross-linking-rules.md)
- [Architecture Document Scope Boundaries](./architecture-document-scope-boundaries.md)
- [Architecture Supersession and Retirement Governance](./architecture-supersession-and-retirement-governance.md)
