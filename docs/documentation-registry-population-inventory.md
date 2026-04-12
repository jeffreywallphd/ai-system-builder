---
title: Documentation Registry Population Inventory
doc_type: baseline
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs/documentation-registry-population-inventory.inventory.json
  - docs/context/documentation-registry.md
  - docs/context/documentation-index-coverage-rules.md
  - docs/architecture/architecture-domain-taxonomy.md
  - dev/tests/DocumentationRegistryPopulationInventoryStory621Guardrails.test.ts
---

# Documentation Registry Population Inventory (Story 6.2.1)

## Documentation Status

- Segment: `Registry Population Planning`
- Lifecycle status (`status`): `active`
- Authority state (`authoritativeness`): `canonical` planning inventory for registry population order
- Current guidance stance: use this inventory to decide population order; use active architecture/contributor/operations/ADR docs as implementation authority
- Canonical active path(s): `docs/context/documentation-registry.md`, `docs/context/documentation-index-coverage-rules.md`, and `docs/architecture/README.md`

## Purpose

Create a practical, high-value-first inventory of documentation targets for registry population so entry creation is deliberate instead of ad hoc.

## Scope

- Story scope: `6.2.1`
- Approach: high-value-first, not exhaustive
- Grounding: current documentation architecture, indexing coverage rules, and architecture domain taxonomy
- Machine-readable inventory: `docs/documentation-registry-population-inventory.inventory.json`

## Inventory Summary

- Total candidates: `32`
- Priority tiers: `p0` (`12`), `p1` (`13`), `p2` (`7`)
- Population classes:
  - `authoritative-active` (`26`)
  - `baseline-historical` (`6`)
- Category coverage:
  - `active-architecture`
  - `active-contributors`
  - `active-operations`
  - `adr-records`
  - `context-packs`
  - `baselines`
  - `superseded-and-historical`

## Highest-Priority Registry Population Targets

| Candidate | Category | Likely domain/type/status | Population class | Why it goes first |
| --- | --- | --- | --- | --- |
| `docs/architecture/domain-and-application-core.md` | active-architecture | `architecture` / `architecture-overview` / `active` | authoritative-active | Primary architecture authority entrypoint for broad routing. |
| `docs/architecture/architecture-domain-taxonomy.md` | active-architecture | `architecture` / `architecture-reference` / `active` | authoritative-active | Defines stable domain map used by discovery and routing. |
| `docs/contributors/docs-placement-guide.md` | active-contributors | `contributors` / `contributor-guide` / `active` | authoritative-active | First-stop contributor placement and routing authority. |
| `docs/node-bootstrap-identity-operations.md` | active-operations | `operations` / `runbook` / `active` | authoritative-active | High-value operational anchor for runtime/admin workflows. |
| `docs/adr/records/adr-001-single-authoritative-control-plane.md` | adr-records | `decision-records` / `adr` / `active` | authoritative-active | Foundational architecture decision lineage anchor. |
| `docs/context/packs/repository-overview.pack.md` | context-packs | `documentation` / `ai-context` / `active` | authoritative-active | Global context-pack anchor used by many task routes. |
| `docs/context/packs/architecture-core.pack.md` | context-packs | `architecture` / `ai-context` / `active` | authoritative-active | High-signal architecture context assembly anchor. |
| `docs/context/packs/runtime-and-host.pack.md` | context-packs | `architecture` / `ai-context` / `active` | authoritative-active | Frequent runtime troubleshooting and host workflow context path. |
| `docs/context/packs/identity-and-security.pack.md` | context-packs | `identity-and-security` / `ai-context` / `active` | authoritative-active | Security-sensitive work typically routes through this pack. |
| `docs/context/packs/studio-and-system-composition.pack.md` | context-packs | `architecture` / `ai-context` / `active` | authoritative-active | Canonical compact path for studio/system composition context. |
| `docs/context/packs/documentation-refactor.pack.md` | context-packs | `documentation` / `ai-context` / `active` | authoritative-active | Core pack for documentation-system stories and review. |
| `docs/documentation-migration-baseline.md` | baselines | `baselines` / `baseline` / `active` | baseline-historical | Selective historical anchor for migration lineage and context. |

## Category Coverage and Classification Notes

- `Required coverage first`: populate from `active-architecture`, `active-contributors`, `active-operations`, `adr-records`, and `context-packs` before deeper selective historical indexing.
- `Selective historical coverage`: include `baselines` and `superseded-and-historical` only for durable anchors and redirect/lineage needs.
- `Likely metadata fields`: each candidate includes likely `domain`, `docType`, `status`, and `authoritativeness` to reduce later interpretation drift during entry authoring.

## Recommended Population Sequence (Practical)

1. `Phase 1 (authority spine)`: populate the 12 `p0` anchors for architecture, contributors, operations, ADR, context-pack, and one baseline lineage pivot.
2. `Phase 2 (active breadth)`: populate `p1` domain overviews, additional contributor/runbook anchors, and remaining high-value ADRs.
3. `Phase 3 (selective historical traceability)`: add `p2` operations long-tail plus curated baseline/superseded anchors only.

## Deliberate Population Rules for Follow-On Stories

- Keep one registry entry per human doc path; set `aiPath` instead of duplicating AI-only entries.
- Preserve active authority precedence: classify active canonical/reference docs before baseline and superseded records.
- Use this inventory’s likely metadata as a starting point, then confirm final values from frontmatter and taxonomy contracts.
- Keep registry updates aligned with coverage policy boundaries in `documentation-registry.seed.json`.

## Related Documentation

- [Documentation Registry Structure](./context/documentation-registry.md)
- [Documentation Index Coverage Rules](./context/documentation-index-coverage-rules.md)
- [Documentation Indexed Document Metadata](./context/documentation-indexed-document-metadata.md)
- [Documentation Identity, Stable Keys, and Reference Conventions](./context/documentation-identity-and-reference-conventions.md)
- [Architecture Documentation Router](./architecture/README.md)
- [Architecture Domain Taxonomy](./architecture/architecture-domain-taxonomy.md)
