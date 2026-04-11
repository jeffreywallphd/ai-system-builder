# Context Packs Directory

## Audience
- Engineers and assistants authoring reusable AI context packs.
- Maintainers managing pack catalog metadata and pack ownership.

## Purpose
- Provide a stable home for pack catalog contracts and pack artifacts used by context routing.
- Define the standard context-pack contract so future packs are authored with consistent scope and structure.

## Belongs Here
- Machine-readable context pack catalog contracts and seed data.
- Canonical context packs shared across multiple features.
- Pack-level routing hints and ownership metadata.

## Does Not Belong Here
- Operational runbooks or troubleshooting procedures.
- Feature-local implementation checklists.
- Architecture decision records.

## Start Here
- [Context Pack Contract (Machine-Readable)](./context-pack.contract.json)
- [Context Pack Catalog Contract](./context-pack-catalog.contract.json)
- [Context Pack Catalog Seed](./context-pack-catalog.seed.json)
- [Context Asset Metadata Standard](../context-asset-metadata.md)
- [Seed Pack: Repository Overview](./repository-overview.pack.md)
- [Seed Pack: Core Architecture](./architecture-core.pack.md)
- [Seed Pack: Context System Foundations](./context-system-foundations.pack.md)
- [Seed Pack: Runtime and Host](./runtime-and-host.pack.md)
- [Seed Pack: Identity and Security](./identity-and-security.pack.md)
- [Seed Pack: Studio and System Composition](./studio-and-system-composition.pack.md)
- [Context Taxonomy Router](../README.md)
- [Context Pack Template](../templates/context-pack.template.md)
- [AI Context Template](../templates/ai-context.template.md)

## Standard Context Pack Contract

Canonical contract sources:

- Human-readable: this file (`docs/context/packs/README.md`)
- AI-readable: `docs/context/packs/README.ai.md`
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

Catalog entries in `context-pack-catalog.seed.json` must follow the metadata baseline in `docs/context/context-asset-metadata.contract.json`.

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

`reviewExpectations` is optional, but when present it must include `cadence`.

### Brevity and Signal-To-Noise Rules

- Keep packs concise and retrieval-first; target less than 900 words when practical.
- Keep sections concise; target less than 160 words per section when practical.
- Prefer bullets and explicit repo paths over narrative prose.
- Link to canonical docs/code instead of copying long source material.

### Content That Must Not Appear in a Context Pack

- step-by-step runbook procedures
- feature implementation checklists
- release notes or changelog narrative
- duplicated long-form architecture/contributor docs
- speculative roadmap backlog content
