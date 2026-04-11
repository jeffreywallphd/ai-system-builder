# Context Map

This document defines the initial machine-readable context map used to resolve task categories to context packs deterministically.

## Purpose

Provide a stable lookup layer between task categories and context assets so routing can stay explicit, low-noise, and easy to validate.

## Canonical Sources

- Human-readable: `docs/context/context-map.md`
- AI-readable: `docs/context/context-map.ai.md`
- Machine-readable: `docs/context/context-map.json`

## Contract Alignment

- Routing contract: `docs/context/routing/task-to-context-routing.contract.json`
- Routing seed: `docs/context/routing/task-to-context-routing.seed.json`
- Pack catalog seed: `docs/context/packs/context-pack-catalog.seed.json`

The map intentionally reuses task category identifiers, selection modes, and priority tiers from the routing contract.

## Top-Level Shape

- `schemaVersion`: map contract version (`1.0.0`).
- `artifactType`: fixed value (`context-map`).
- `status`: lifecycle marker for the map artifact.
- `taskCategoryDefaults`: deterministic per-category defaults (`taskCategoryId`, `selectionMode`, `priorityTier`).
- `globalExclusionRules`: shared exclusion guidance applied before fallback logic.
- `taskCategoryMappings`: explicit category-to-pack mappings with stable identifiers.

## Mapping Entry Shape

Each mapping entry in `taskCategoryMappings` includes:

- `mappingId`: stable mapping identifier.
- `taskCategoryId`: category identifier from the routing contract.
- `intentId`: stable intent identifier for audit and future automation.
- `packRefs`: ordered pack references using `priorityOrder` (lower wins).
- `excludePackIds`: explicit pack exclusions.
- `notes`: short maintenance or scope notes.
- `status`: lifecycle marker for the mapping entry.

## Scope

This first version is intentionally scoped:

- one deterministic mapping per supported task category;
- one active pack reference (`context-system-foundations`) per mapping;
- explicit exclusions and notes for future extension;
- no runtime resolver implementation in this story.

## Validation

- Guardrail test: `dev/tests/ContextMapGuardrails.test.ts`
- Structure guardrail: `dev/tests/ContextEngineeringStructureGuardrails.test.ts`

