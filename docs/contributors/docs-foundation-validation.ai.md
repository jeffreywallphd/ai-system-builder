---
title: AI Companion: Documentation Foundation Validation Guide
doc_type: contributor-guide
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - dev/scripts/validate-docs-foundation.cjs
  - dev/scripts/validate-adr-records.cjs
  - dev/scripts/validate-architecture-domains.cjs
  - dev/scripts/validate-docs-segmentation.cjs
  - dev/tests/DocsFoundationValidationScript.test.ts
  - dev/tests/AdrValidationScript.test.ts
  - dev/tests/ArchitectureDomainValidationScript.test.ts
  - dev/tests/DocsSegmentationValidationScript.test.ts
---

# AI Companion: Documentation Foundation Validation Guide

## Purpose and Audience

Use this guide to run the baseline docs foundation validator before or during documentation changes.

## What the Validator Checks

- Required top-level docs folders exist.
- Root and top-level routers keep required `README.md` and `README.ai.md` files.
- Required `docs/context` foundation subfolders and seed artifacts exist (`packs`, `routing`, `governance`, `templates`).
- Context foundation contract/seed JSON artifacts keep expected schema markers.
- Context map shape remains valid and references stay resolvable (task categories, profile IDs, exclusion tags, pack IDs).
- Context pack catalog entries keep required metadata shape and valid `primaryDocPath` / `aiDocPath` links.
- Context pack catalog `relatedDocPaths` and `relatedCodePaths` resolve to real files or directories.
- Context pack markdown files keep required headings from `docs/context/packs/context-pack.contract.json`.
- Context pack `## Authoritative Docs`, `## Authoritative Code Paths`, and `## Related Packs` references remain resolvable.
- Routing mapping `relatedDocPaths` and `relatedCodePaths` references resolve to real repository paths.
- Routing worked examples keep valid `expectedPackOrder` IDs and resolvable `expectedRelatedDocOrder` paths.
- Seed docs keep required metadata header fields with taxonomy-aligned enum values.
- Seed `.md` and `.ai.md` pairs stay aligned on routing metadata.
- ADR validators also enforce cross-reference integrity in high-value paths.
- ADR `## Related Documentation` references resolve and linked ADR targets are present in `adr-registry.json`.
- Architecture `## Related ADRs` references resolve and point to registered ADR records.
- Context pack `## Authoritative Docs` ADR references resolve and point to registered ADR records.
- ADR index files (`docs/adr/records/README.md` and `.ai.md`) stay synchronized with `adr-registry.json`.
- Architecture domain folders match taxonomy-defined domain IDs.
- Each domain keeps required `overview(.ai).md` and `references/README(.ai).md` files.
- Domain overviews and reference indexes keep required routing links (`./references/README.md` and `../overview.md`).
- Core markdown links in domain routers, domain overviews, and reference indexes resolve to real repository paths.
- Domain reference docs maintain `.md` and `.ai.md` companion pairing.
- Segmentation status-signal anchor docs keep required `## Documentation Status` markers.
- Segmentation inventory candidates keep baseline destination guidance for non-superseded historical material.
- Supersession registry entries keep frontmatter and destination alignment.
- Active top-level routers avoid linking to superseded paths.

## Run Command

```bash
npm run docs:validate:foundation
npm run docs:validate:adr
npm run docs:validate:architecture-domains
npm run docs:validate:segmentation
```

## CI Contract

Use the same command in CI so baseline structure regressions fail fast with clear codes.

## Common Failure Codes

- `TOP_LEVEL_FOLDER_MISSING`
- `ROUTER_FILE_MISSING`
- `CONTEXT_SUBFOLDER_MISSING`
- `CONTEXT_FILE_MISSING`
- `CONTEXT_MAP_INVALID`
- `CONTEXT_MAP_INVALID_REFERENCE`
- `CONTEXT_PACK_SHAPE_INVALID`
- `CONTEXT_PACK_REFERENCE_INVALID`
- `ROUTING_REFERENCE_INVALID`
- `FRONTMATTER_INVALID`
- `HEADER_ENUM_INVALID`
- `SEED_PAIR_MISMATCH`
- `ADR_REQUIRED_SECTION_MISSING`
- `ADR_IDENTIFIER_MISMATCH`
- `ADR_SECTION_METADATA_MISMATCH`
- `ADR_RELATED_DOC_REFERENCE_INVALID`
- `ADR_RELATED_ADR_TARGET_MISSING`
- `ARCHITECTURE_ADR_REFERENCE_INVALID`
- `CONTEXT_PACK_ADR_REFERENCE_INVALID`
- `ADR_INDEX_REFERENCE_INVALID`
- `ADR_INDEX_REFERENCE_MISSING`
- `DOMAIN_DIRECTORY_MISSING`
- `DOMAIN_DIRECTORY_UNEXPECTED`
- `DOMAIN_REQUIRED_FILE_MISSING`
- `DOMAIN_REQUIRED_LINK_MISSING`
- `DOMAIN_CORE_LINK_MISSING`
- `DOMAIN_REFERENCE_PAIR_MISSING`
- `STATUS_SIGNAL_DOC_MISSING`
- `STATUS_SIGNAL_MARKER_MISSING`
- `SEGMENTATION_INVENTORY_INVALID`
- `BASELINE_DESTINATION_INVALID`
- `SEGMENTATION_SUPERSESSION_LINK_MISSING`
- `SEGMENTATION_SUPERSESSION_LINK_INVALID`
- `SUPERSESSION_REGISTRY_INVALID`
- `SUPERSESSION_DESTINATION_INVALID`
- `SUPERSESSION_METADATA_MISMATCH`
- `SUPERSESSION_SECTION_MISSING`
- `ACTIVE_PATH_REFERENCE_INVALID`

## Scope Notes

This check is an early guardrail. Keep it lightweight and focused on baseline structure and metadata contract consistency.
