# AI Companion: Context Packs Directory

## Audience
- AI assistants and engineers creating reusable context packs.
- Maintainers curating pack metadata and ownership.

## Purpose
- Canonical location for pack catalog contracts and shared pack artifacts.
- Canonical context-pack contract for deterministic authoring and routing-ready pack content.

## Belongs Here
- Pack catalog contract and seed files.
- Cross-feature reusable AI context packs.
- Pack-level routing metadata and owner assignments.

## Does Not Belong Here
- Runbooks or operational recovery procedures.
- Feature-specific coding workflows.
- ADR decision history.

## Start Here
- [Context Pack Contract (Machine-Readable)](./context-pack.contract.json)
- [Context Pack Catalog Contract](./context-pack-catalog.contract.json)
- [Context Pack Catalog Seed](./context-pack-catalog.seed.json)
- [Context Asset Metadata Standard](../context-asset-metadata.ai.md)
- [Seed Pack: Repository Overview](./repository-overview.pack.ai.md)
- [Seed Pack: Core Architecture](./architecture-core.pack.ai.md)
- [Seed Pack: Context System Foundations](./context-system-foundations.pack.ai.md)
- [Seed Pack: Documentation Refactor](./documentation-refactor.pack.ai.md)
- [Seed Pack: Runtime and Host](./runtime-and-host.pack.ai.md)
- [Seed Pack: Identity and Security](./identity-and-security.pack.ai.md)
- [Seed Pack: Studio and System Composition](./studio-and-system-composition.pack.ai.md)
- [Context Router](../README.ai.md)
- [Context Pack Template](../templates/context-pack.template.ai.md)
- [AI Context Template](../templates/ai-context.template.ai.md)

## Standard Context Pack Contract

Canonical contract sources:

- Human-readable: `docs/context/packs/README.md`
- AI-readable: this file (`docs/context/packs/README.ai.md`)
- Machine-readable: `docs/context/packs/context-pack.contract.json`

### Required Sections (Exact Headings)

Every context pack file in `docs/context/packs/` must include:

1. `## Purpose`
2. `## When To Use`
3. `## When Not To Use`
4. `## Invariants`
5. `## Authoritative Docs`
6. `## Authoritative Code Paths`
7. `## Anti-Patterns`
8. `## Related Packs`

### Optional Sections

- `## Retrieval Order`
- `## Change Triggers`

## Context Pack Catalog Metadata Contract

Catalog entries in `context-pack-catalog.seed.json` must follow `docs/context/context-asset-metadata.contract.json`.

### Required Catalog Entry Fields

- `id`
- `title`
- `purpose`
- `domain`
- `owner`
- `status`
- `primaryDocPath`
- `aiDocPath`
- `relatedDocPaths`
- `relatedCodePaths`

### Optional Catalog Entry Fields

- `tags`
- `notes`
- `reviewExpectations`

If `reviewExpectations` is set, it must include `cadence`.

### Brevity and Signal Rules

- Keep packs concise and retrieval-first; target less than 900 words when practical.
- Keep sections concise; target less than 160 words per section when practical.
- Prefer bullets and stable repo paths over narrative text.
- Link to canonical docs/code rather than duplicating long explanations.

### Do Not Include

- runbook procedures
- implementation checklists
- release-note narrative
- duplicated long-form canonical doc content
- speculative roadmap backlog
