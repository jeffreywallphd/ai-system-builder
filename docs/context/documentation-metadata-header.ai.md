# AI Companion: Standard Documentation Metadata Header Contract (Story 1.2.2)

Use this file for exact metadata-header formatting and required field semantics.

## Canonical Sources

- Human-readable contract: `docs/context/documentation-metadata-header.md`
- Machine-readable contract: `docs/context/documentation-metadata-header.contract.json`
- Taxonomy values source: `docs/context/documentation-taxonomy.contract.json`

## Chosen Representation

- YAML frontmatter is the canonical metadata representation.
- `yaml-frontmatter` as the first block in each markdown document.
- Always wrap with `---` opening and closing delimiters.

## Required Header Fields

- `title`
- `doc_type`
- `status`
- `authoritativeness`
- `owned_by`
- `last_reviewed`

## Optional Header Fields

- `related_code_paths`
- `supersedes`
- `superseded_by`

## Enforcement Rules

- `supersedes` and `superseded_by` cannot both be present.
- `status: superseded` requires `superseded_by`.
- `last_reviewed` must not be in the future.

## Common Type Examples Included

- `architecture-overview`
- `architecture-reference`
- `contributor-guide`
- `runbook`
- `adr`
- `baseline`
- `ai-context`

## Guardrail

- Validation test: `dev/tests/DocumentationMetadataHeaderGuardrails.test.ts`
