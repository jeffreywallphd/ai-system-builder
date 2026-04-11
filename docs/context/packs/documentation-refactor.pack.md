# Documentation Refactor Pack

## Purpose

- Provide focused context for documentation-system refactor work so docs changes stay architecture-aligned, low-noise, and migration-safe.
- Capture canonical rules for docs taxonomy, metadata, placement, routing, and migration without reloading large planning files.

## When To Use

- Refactoring docs structure in `docs/context`, `docs/architecture`, and `docs/contributors`.
- Updating doc metadata/taxonomy contracts or router/overview guidance.
- Planning or implementing doc migration slices that require guardrail and validation alignment.
- Decomposing documentation-refactor stories into implementation, test, and doc-update tasks.

## When Not To Use

- Runtime feature implementation in `src/` where docs are incidental.
- Incident/runbook work that belongs in operational procedures.
- Deep architecture-domain changes where the primary task is code or runtime behavior, not documentation-system evolution.

## Invariants

- Keep `.md` and `.ai.md` companion docs aligned when both exist.
- Keep one authoritative home per responsibility; use links instead of duplicate canonical content.
- Preserve metadata contract fidelity (`doc_type`, `status`, `authoritativeness`, ownership, and review date).
- Treat migration baseline artifacts as historical references, not canonical replacements.
- Keep router/overview docs concise and link-first; avoid catch-all growth.

## Authoritative Docs

- `docs/architecture/README.md`
- `docs/documentation-migration-baseline.md`
- `docs/contributors/docs-placement-guide.md`
- `docs/contributors/docs-migration-safety-guide.md`
- `docs/contributors/docs-foundation-validation.md`
- `docs/contributors/router-overview-writing-standard.md`
- `docs/context/documentation-taxonomy.md`
- `docs/context/documentation-metadata-header.md`
- `docs/context/prompt-routing.md`

## Authoritative Code Paths

- `dev/scripts/validate-docs-foundation.cjs`
- `dev/tests/DocsFoundationValidationScript.test.ts`
- `dev/tests/DocsPlacementGuideGuardrails.test.ts`
- `dev/tests/DocumentationMigrationSafetyGuideGuardrails.test.ts`
- `dev/tests/DocumentationRouterOverviewWritingStandardGuardrails.test.ts`
- `dev/tests/DocumentationRefactorContextPackGuardrails.test.ts`
- `docs/context/packs/context-pack-catalog.seed.json`
- `docs/context/routing/task-to-context-routing.seed.json`

## Anti-Patterns

- Copying architecture/contributor docs verbatim into context packs.
- Moving docs without pointer/deprecation handling or metadata lifecycle updates.
- Allowing multiple canonical docs for the same responsibility after a split.
- Treating archived migration baseline materials as current authoritative guidance.
- Expanding router docs into long procedural runbooks.

## Related Packs

- `repository-overview`: load first for broad repository orientation and boundary context.
- `architecture-core`: combine when docs changes alter architecture contract surfaces or boundary language.
- `context-system-foundations`: combine when docs refactor work also changes context contracts, routing contracts, or governance assets.

## Retrieval Order

1. `docs/context/packs/repository-overview.pack.md`
2. `docs/context/packs/architecture-core.pack.md`
3. `docs/context/packs/documentation-refactor.pack.md`
4. `docs/contributors/docs-placement-guide.md`
5. `docs/contributors/docs-migration-safety-guide.md`
6. `docs/contributors/router-overview-writing-standard.md`

## Change Triggers

- Documentation taxonomy or metadata contract enum changes.
- Router/overview writing-standard changes.
- Validation script or guardrail test changes affecting docs foundation expectations.
- New canonical docs-refactor architecture references or renamed docs-system paths.
