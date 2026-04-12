# AI Companion: Context Asset Metadata Standard

Use this file to apply consistent metadata across pack catalog entries and routing records.

## Canonical Sources

- Human-readable: `docs/context/context-asset-metadata.md`
- AI-readable: `docs/context/context-asset-metadata.ai.md`
- Machine-readable: `docs/context/context-asset-metadata.contract.json`

## Required Fields

- `id`
- `title`
- `purpose`
- `domain`
- `owner`
- `status`
- `relatedDocPaths`
- `relatedCodePaths`

## Optional Fields

- `tags`
- `notes`
- `reviewExpectations`

`reviewExpectations` is optional; when present it must include `cadence`.

## Usage Rules

- Keep `id` stable after publication.
- Use status enums from the asset-specific contract (`context-pack-catalog` or `task-to-context-routing-map`).
- Keep related paths explicit, canonical, and minimal.
- Add `reviewExpectations` for assets that need scheduled review visibility.

## Guardrails

- `dev/tests/ContextAssetMetadataStandardsGuardrails.test.ts`
- `dev/tests/ContextPackContractGuardrails.test.ts`
- `dev/tests/TaskToContextRoutingContractGuardrails.test.ts`
