---
title: "AI Companion: Architecture Migration Sequence and Priority Order"
doc_type: architecture-reference
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - docs/architecture/architecture-domain-migration-inventory.ai.md
  - docs/architecture/architecture-domain-migration-inventory.inventory.json
  - docs/architecture/architecture-migration-sequence-and-priority.sequence.json
  - dev/tests/ArchitectureMigrationSequenceGuardrails.test.ts
---

# AI Companion: Architecture Migration Sequence and Priority Order

## Purpose

Define a deterministic migration order so AI-assisted and human contributors migrate architecture docs in the same priority sequence, with explicit dependency and coexistence rules.

## Sequencing Goals

- Prioritize boundaries with highest operational and security impact.
- Keep coupled mapping units in the same wave to avoid partial authority splits.
- Preserve one canonical source of truth for each contract during transition.
- Keep wave size reviewable and testable.

## Priority Waves

Use this sequence as default. Mapping IDs come from `architecture-domain-migration-inventory.inventory.json`.

| Wave | Priority | Target domains | Mapping IDs | Why this moves first |
| --- | --- | --- | --- | --- |
| `wave-0-router-and-rules` | `P0` | `core-platform-and-composition` | `map-001` | Establishes migration guardrails (taxonomy/scope/cross-linking) before domain content movement. |
| `wave-1-security-and-runtime-boundaries` | `P1` | `core-platform-and-composition`, `runtime-host-surfaces`, `identity-trust-and-security` | `map-002`, `map-003`, `map-004`, `map-005`, `map-006`, `map-007`, `map-008` | Highest-value first: trust, startup gates, and runtime authority shape downstream domain contracts. |
| `wave-2-storage-and-control-plane-authority` | `P2` | `workspace-storage-and-assets`, `execution-control-plane-and-scheduling` | `map-009`, `map-010`, `map-011`, `map-012`, `map-013` | Storage/asset and run-control boundaries depend on wave 1 and unblock later API consistency. |
| `wave-3-api-surface-stabilization` | `P3` | `api-and-transport-surfaces` | `map-016`, `map-017` | API/transport contracts stabilize best after execution/storage authority is migrated. |
| `wave-4-studio-composition-alignment` | `P4` | `studio-and-system-composition` | `map-014`, `map-015` | Studio composition is cross-domain; sequencing it later reduces churn and duplicate rewrites. |
| `wave-5-governance-and-historical-cleanup` | `P5` | `deployment-policy-and-audit-governance`, `identity-trust-and-security` plus baseline archive paths | `map-018`, `map-019`, `map-020`, `map-021`, `map-022` | Finalizes governance references and archives historical docs once active-domain authority is stable. |

## Dependency Rules and Gating Criteria

1. Prior-wave completion gate: dependent waves do not start until predecessor mappings are migrated or explicitly deferred.
2. Single-authority gate: destination docs become canonical and legacy duplicates are converted to stubs in the same batch.
3. Companion parity gate: `.md` and `.ai.md` companions are updated together.
4. Routing gate: architecture routers and domain `references/README.md` indexes are updated for moved authority.
5. Validation gate: migration guardrail tests pass for the changed wave.

## Temporary Coexistence Strategy (Old and New Docs)

Allowed coexistence states for legacy flat docs:

1. `legacy-authority`: not migrated yet.
2. `migration-in-progress`: split in progress with explicit target links.
3. `migrated-link-stub`: legacy doc remains only as redirect pointer.
4. `historical-baseline`: moved into `docs/baselines/`.

Transition rules:

1. Never keep two active authority docs for one contract.
2. Convert replaced legacy docs to short stubs with canonical links.
3. Retain legacy paths as stubs until inbound routers/context packs are updated.
4. Remove stubs only after inbound links and tests confirm migration safety.

## Contributor Execution Checklist per Wave

1. Confirm current wave scope and dependency satisfaction.
2. Migrate only wave-listed mapping IDs into domain overview/reference targets.
3. Update `.md` and `.ai.md` files together.
4. Convert or archive legacy paths according to target role.
5. Update routers and reference indexes.
6. Run guardrail tests before merge.

## Related Documentation

- [Architecture Documentation Router](./README.md)
- [Architecture Domain Migration Inventory](./architecture-domain-migration-inventory.md)
- [Architecture Domain Taxonomy](./architecture-domain-taxonomy.md)
- [Architecture Domain Cross-Linking Rules](./architecture-domain-cross-linking-rules.md)
- [Architecture Document Scope Boundaries](./architecture-document-scope-boundaries.md)
