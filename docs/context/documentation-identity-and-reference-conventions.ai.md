---
title: "AI Companion: Documentation Identity, Stable Keys, and Reference Conventions"
doc_type: ai-context
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs/context/documentation-identity-and-reference.contract.json
  - docs/context/documentation-registry.seed.json
  - docs/context/routing/task-to-context-routing.contract.json
  - docs/context/packs/context-pack-catalog.contract.json
  - dev/scripts/validate-docs-foundation.cjs
  - dev/tests/DocumentationIdentityReferenceConventionsGuardrails.test.ts
---

# AI Companion: Documentation Identity, Stable Keys, and Reference Conventions (Story 6.1.4)

Use this file for canonical document identity and cross-artifact referencing conventions.

## Canonical Sources

- Human-readable: `docs/context/documentation-identity-and-reference-conventions.md`
- AI-readable: `docs/context/documentation-identity-and-reference-conventions.ai.md`
- Machine-readable: `docs/context/documentation-identity-and-reference.contract.json`

## Identity Summary

- `recordId` is the stable identity key for indexed docs.
- `path` remains canonical file location but is not the only linking key.
- `recordId` format: `^doc-[a-z0-9]+(?:-[a-z0-9]+)*$`.

## Reference Conventions

- Registry entries can use `relatedRecordIds`.
- Routing assets can use `relatedDocRecordIds`.
- Context pack catalog entries can use `relatedDocRecordIds`.
- Path lists remain supported for compatibility and direct file resolution.

## Path Rules

- Human path starts with `docs/`, ends with `.md`, and must not end with `.ai.md`.
- `aiPath` is optional but must end with `.ai.md` when set.

## Stability Rules

- Do not change published `recordId` values for path moves.
- Keep keys semantic, lowercase kebab-case, and prefixed with `doc-`.
- Do not encode dates or temporary rollout identifiers in stable keys.

## Guardrails

- `dev/tests/DocumentationIdentityReferenceConventionsGuardrails.test.ts`
- `dev/scripts/validate-docs-foundation.cjs`

