---
title: Documentation Identity, Stable Keys, and Reference Conventions
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

# Documentation Identity, Stable Keys, and Reference Conventions (Story 6.1.4)

This document defines a lightweight identity and reference convention for indexed documentation.

## Purpose

Provide a stable, machine-readable way to identify and reference docs so cross-artifact links remain durable when paths move.

## Canonical Sources

- Human-readable: `docs/context/documentation-identity-and-reference-conventions.md`
- AI-readable: `docs/context/documentation-identity-and-reference-conventions.ai.md`
- Machine-readable: `docs/context/documentation-identity-and-reference.contract.json`

## Identity Model

- Registry entry identity key is `recordId`.
- `recordId` is the stable key for cross-artifact references.
- `path` remains the canonical file location, but must not be the only linkage key.
- `recordId` format is lowercase kebab-case with `doc-` prefix:
  `^doc-[a-z0-9]+(?:-[a-z0-9]+)*$`

## Path Reference Rules

- Canonical doc paths must be repo-relative.
- Human doc path (`path`) must start with `docs/`, end with `.md`, and not end with `.ai.md`.
- AI companion path (`aiPath`) must end with `.ai.md` when present.
- Path references are for file resolution; stable references should use `recordId`.

## Cross-Artifact Reference Conventions

- Registry entries may use `relatedRecordIds` to reference other registry entries by stable key.
- Routing mappings and examples may use `relatedDocRecordIds` to reference registry entries.
- Context pack catalog entries may use `relatedDocRecordIds` to reference registry entries.
- Path-based lists (`relatedDocs`, `relatedDocPaths`) remain supported for compatibility.

## Naming Conventions

- Keep `recordId` semantic and deterministic:
  - `doc-<area>-<topic>`
  - Include domain hints when helpful (`doc-context-...`, `doc-architecture-...`).
- Do not encode dates, story numbers, or temporary branch names in `recordId`.
- Preserve `recordId` after publication; moving a file should update `path`, not identity.

## Validation and Maintainability

- Validation must enforce `recordId` format and uniqueness.
- When `relatedRecordIds` or `relatedDocRecordIds` are provided, each referenced id must exist in the registry.
- Linking by stable keys reduces brittle path-coupling across registry, routing, and context-pack artifacts.

