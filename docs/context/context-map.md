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
- `contextAssemblyPolicy`: shared tier ordering, profile catalog, and default weight semantics for context assembly.
- `taskCategoryDefaults`: deterministic per-category defaults (`taskCategoryId`, `selectionMode`, `priorityTier`, `contextAssemblyProfileId`).
- `globalExclusionRules`: shared exclusion guidance applied before fallback logic.
- `globalExclusionTags`: stable exclusion tag identifiers for anti-noise enforcement.
- `authorityTagCatalog`: stable tags separating authoritative sources from related-only sources.
- `taskCategoryMappings`: explicit category-to-pack mappings with stable identifiers.

## Mapping Entry Shape

Each mapping entry in `taskCategoryMappings` includes:

- `mappingId`: stable mapping identifier.
- `taskCategoryId`: category identifier from the routing contract.
- `intentId`: stable intent identifier for audit and future automation.
- `packRefs`: ordered pack references using `priorityOrder` (lower wins).
- `contextAssemblyProfileId`: assembly profile identifier from `contextAssemblyPolicy.profileCatalog`.
- `contextAssemblyTierHints`: mapping-level tier weights and inclusion defaults for `foundation`, `domain`, `implementation`, and `optional`.
- `excludePackIds`: explicit pack exclusions.
- `exclusionTagIds`: explicit anti-noise exclusion tags applied for the mapping.
- `authoritativeSourceTags`: source tags that are allowed to drive decisions.
- `relatedSourceTags`: source tags that are context-only and require explicit justification.
- `notes`: short maintenance or scope notes.
- `status`: lifecycle marker for the mapping entry.

## Scope

This first version is intentionally scoped:

- one deterministic mapping per supported task category;
- one deterministic baseline route per mapping with category-specific domain-pack insertion (`runtime-and-host` for runtime/host routes, `identity-and-security` for security-sensitive routes, `studio-and-system-composition` for studio/system routes, `documentation-refactor` for docs-system routes) before `context-system-foundations`;
- one deterministic four-tier assembly profile shared across initial task categories;
- explicit exclusion tags, authority tags, and notes for future extension;
- no runtime resolver implementation in this story.

## Validation

- Guardrail test: `dev/tests/ContextMapGuardrails.test.ts`
- Structure guardrail: `dev/tests/ContextEngineeringStructureGuardrails.test.ts`

