# AI Companion: Context Map

Use this file with `docs/context/context-map.json` to keep deterministic task-to-pack routing explicit and maintainable.

## Canonical Sources

- Human-readable: `docs/context/context-map.md`
- AI-readable: `docs/context/context-map.ai.md`
- Machine-readable: `docs/context/context-map.json`

## Contract Dependencies

- `docs/context/routing/task-to-context-routing.contract.json`
- `docs/context/routing/task-to-context-routing.seed.json`
- `docs/context/packs/context-pack-catalog.seed.json`

## Required Map Concepts

- Stable task category identifiers (`taskCategoryId`)
- Stable mapping identifiers (`mappingId`)
- Stable intent identifiers (`intentId`)
- Ordered pack references (`packRefs[].priorityOrder`)
- Deterministic assembly tier order and profile catalog (`contextAssemblyPolicy`)
- Mapping-level profile and tier hints (`contextAssemblyProfileId`, `contextAssemblyTierHints`)
- Explicit exclusions (`excludePackIds` and `globalExclusionRules`)
- Stable exclusion tags (`globalExclusionTags[].tagId`, `exclusionTagIds`)
- Source authority tags (`authoritativeSourceTags`, `relatedSourceTags`)

## Authoring Rules

- Keep task categories aligned to the routing contract category IDs.
- Keep `selectionMode` and `priorityTier` aligned with routing defaults unless a documented exception is required.
- Keep `contextAssemblyProfileId` aligned with task-category defaults unless a documented exception is required.
- Keep `contextAssemblyTierHints` complete and descending by weight (`foundation` > `domain` > `implementation` > `optional`).
- Keep `packRefs` deterministically ordered and minimal.
- Keep exclusion tags and authority tags explicit for every mapping.
- Keep authoritative and related source tags distinct; related tags are context-only.
- Keep mappings scoped and explicit; do not add speculative categories.
- Keep notes short and focused on routing behavior.
- Keep deterministic core-pack ordering explicit: `repository-overview`, then `architecture-core`, then `context-system-foundations` unless a documented exception is required.

## Guardrails

- `dev/tests/ContextMapGuardrails.test.ts`
- `dev/tests/ContextEngineeringStructureGuardrails.test.ts`
- `dev/tests/TaskToContextRoutingContractGuardrails.test.ts`

