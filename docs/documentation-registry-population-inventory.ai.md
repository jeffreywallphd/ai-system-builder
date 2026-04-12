---
title: "AI Companion: Documentation Registry Population Inventory"
doc_type: baseline
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs/documentation-registry-population-inventory.inventory.json
  - docs/context/documentation-registry.ai.md
  - docs/context/documentation-index-coverage-rules.ai.md
  - docs/architecture/architecture-domain-taxonomy.ai.md
  - dev/tests/DocumentationRegistryPopulationInventoryStory621Guardrails.test.ts
---

# AI Companion: Documentation Registry Population Inventory (Story 6.2.1)

## Documentation Status

- Segment: `Registry Population Planning`
- Lifecycle status (`status`): `active`
- Authority state (`authoritativeness`): `canonical` planning inventory for population order
- Current guidance stance: use this inventory to choose population order; rely on active authority docs for implementation decisions
- Canonical active path(s): `docs/context/documentation-registry.ai.md`, `docs/context/documentation-index-coverage-rules.ai.md`, and `docs/architecture/README.ai.md`

## Purpose

Provide a practical target set for registry population so indexing proceeds in a deliberate sequence across required categories first.

## Scope

- Story scope: `6.2.1`
- Method: high-value-first, non-exhaustive inventory
- Grounding inputs: indexing coverage rules, registry structure, and architecture domain taxonomy
- Machine-readable source: `docs/documentation-registry-population-inventory.inventory.json`

## Inventory Summary

- Total candidates: `32`
- Priority tiers: `p0` (`12`), `p1` (`13`), `p2` (`7`)
- Population classes: `authoritative-active` (`26`), `baseline-historical` (`6`)
- Covered categories:
  - `active-architecture`
  - `active-contributors`
  - `active-operations`
  - `adr-records`
  - `context-packs`
  - `baselines`
  - `superseded-and-historical`

## Priority Population Anchors (Phase 1)

- `docs/architecture/domain-and-application-core.md`
- `docs/architecture/architecture-domain-taxonomy.md`
- `docs/contributors/docs-placement-guide.md`
- `docs/node-bootstrap-identity-operations.md`
- `docs/adr/records/adr-001-single-authoritative-control-plane.md`
- `docs/context/packs/repository-overview.pack.md`
- `docs/context/packs/architecture-core.pack.md`
- `docs/context/packs/runtime-and-host.pack.md`
- `docs/context/packs/identity-and-security.pack.md`
- `docs/context/packs/studio-and-system-composition.pack.md`
- `docs/context/packs/documentation-refactor.pack.md`
- `docs/documentation-migration-baseline.md`

## Classification Contract For Follow-On Entry Authoring

- Each candidate includes likely `domain`, `docType`, `status`, and `authoritativeness` for faster entry drafting.
- `authoritative-active` candidates should be populated before `baseline-historical` candidates.
- `baselines` and `superseded-and-historical` entries are selective anchors, not exhaustive file-by-file indexing.
- Keep one human-path entry with optional `aiPath`; do not duplicate AI-only records.

## Recommended Population Sequence

1. Populate all `p0` authority spine anchors.
2. Populate `p1` active breadth (domain overviews, additional runbooks/contributor docs, key ADR lineage).
3. Populate `p2` selective historical and superseded anchors for traceability and redirect-safe lookup.

## Related Documentation

- [Documentation Registry Structure](./context/documentation-registry.ai.md)
- [Documentation Index Coverage Rules](./context/documentation-index-coverage-rules.ai.md)
- [Documentation Indexed Document Metadata](./context/documentation-indexed-document-metadata.ai.md)
- [Documentation Identity, Stable Keys, and Reference Conventions](./context/documentation-identity-and-reference-conventions.ai.md)
- [Architecture Documentation Router](./architecture/README.ai.md)
- [Architecture Domain Taxonomy](./architecture/architecture-domain-taxonomy.ai.md)
