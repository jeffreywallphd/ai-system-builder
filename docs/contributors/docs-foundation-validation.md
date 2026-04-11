---
title: Documentation Foundation Validation Guide
doc_type: contributor-guide
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - dev/scripts/validate-docs-foundation.cjs
  - dev/scripts/validate-documentation-registry.cjs
  - dev/scripts/validate-adr-records.cjs
  - dev/scripts/validate-architecture-domains.cjs
  - dev/scripts/validate-docs-segmentation.cjs
  - dev/tests/DocsFoundationValidationScript.test.ts
  - dev/tests/DocumentationRegistryValidationScript.test.ts
  - dev/tests/DocumentationRegistryCrossReferenceValidationStory642Guardrails.test.ts
  - dev/tests/AdrValidationScript.test.ts
  - dev/tests/ArchitectureDomainValidationScript.test.ts
  - dev/tests/DocsSegmentationValidationScript.test.ts
---

# Documentation Foundation Validation Guide

## Purpose and Audience

Use this guide when you need a fast contract check for the documentation foundation introduced by Feature 1.

## What the Validator Checks

- Required top-level docs folders exist.
- Expected router files exist (`README.md` and `README.ai.md` at root and top-level docs areas).
- Required `docs/context` foundation subfolders and seed artifacts exist (`packs`, `routing`, `governance`, `templates`).
- Documentation indexing model docs remain present with required model headings for human and AI variants.
- Context foundation contracts/seeds are valid JSON and keep expected schema markers.
- Context map shape stays valid and cross-references remain resolvable (routing categories, profile IDs, exclusion tags, and pack IDs).
- Context pack catalog entries keep required metadata shape and valid `primaryDocPath` / `aiDocPath` references.
- Context pack catalog `relatedDocPaths` and `relatedCodePaths` resolve to real files or directories.
- Context pack markdown files keep required section headings from `docs/context/packs/context-pack.contract.json`.
- Context pack `## Authoritative Docs`, `## Authoritative Code Paths`, and `## Related Packs` references remain resolvable.
- Routing mapping `relatedDocPaths` and `relatedCodePaths` references resolve to real repository paths.
- Routing worked examples keep valid `expectedPackOrder` IDs and resolvable `expectedRelatedDocOrder` paths.
- Seed docs have a valid metadata header and stay aligned to taxonomy/metadata contracts.
- Seed `.md` and `.ai.md` pairs stay aligned for routing metadata fields.
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
- Segmentation inventory candidates retain baseline destination guidance for non-superseded historical material.
- Supersession registry entries remain consistent with stub frontmatter and valid superseded destinations.
- Supersession registry canonical destination lists stay resolvable.
- Superseded stub `## Redirect` sections include resolvable local destination paths and include required canonical targets.
- Active top-level routers avoid linking directly to superseded documentation paths.
- Registry validation enforces lightweight shape and metadata invariants for `docs/context/documentation-registry.seed.json`.
- Registry validation also enforces cross-reference integrity for indexed `relatedDocs` to `relatedRecordIds` alignment.

## Run Locally

```bash
npm run docs:validate:foundation
npm run docs:validate:registry
npm run docs:validate:adr
npm run docs:validate:architecture-domains
npm run docs:validate:segmentation
```

## CI Usage

Run the same command in CI to block changes that erode the baseline docs structure contract.

```bash
npm run docs:validate:foundation
npm run docs:validate:registry
npm run docs:validate:adr
npm run docs:validate:architecture-domains
npm run docs:validate:segmentation
```

## Failure Output

Failures are printed with stable error codes so contributors can quickly locate the issue type.

Examples:
- `TOP_LEVEL_FOLDER_MISSING`
- `ROUTER_FILE_MISSING`
- `CONTEXT_SUBFOLDER_MISSING`
- `CONTEXT_FILE_MISSING`
- `CONTEXT_MAP_INVALID`
- `CONTEXT_MAP_INVALID_REFERENCE`
- `CONTEXT_PACK_SHAPE_INVALID`
- `CONTEXT_PACK_REFERENCE_INVALID`
- `ROUTING_REFERENCE_INVALID`
- `HEADER_FIELD_MISSING`
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
- `SUPERSESSION_CANONICAL_DESTINATION_INVALID`
- `SUPERSESSION_METADATA_MISMATCH`
- `SUPERSESSION_SECTION_MISSING`
- `SUPERSESSION_REDIRECT_SECTION_INVALID`
- `SUPERSESSION_REDIRECT_REFERENCE_MISSING`
- `SUPERSESSION_REDIRECT_TARGET_MISSING`
- `SUPERSESSION_REDIRECT_REFERENCE_INVALID`
- `SUPERSESSION_COMPANION_MISSING`
- `ACTIVE_PATH_REFERENCE_INVALID`
- `DOCUMENTATION_INDEX_MODEL_INVALID`
- `REGISTRY_FILE_MISSING`
- `REGISTRY_SHAPE_INVALID`
- `REGISTRY_ENTRY_INVALID`
- `REGISTRY_REFERENCE_INVALID`
- `REGISTRY_CROSS_REFERENCE_INVALID`
- `REGISTRY_TAXONOMY_MISMATCH`

## Scope Notes

This validator is intentionally lightweight. It enforces the initial baseline guardrails and is not a full markdown linting or doc-quality system.
