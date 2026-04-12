# AI Companion: Documentation Refactor Pack

## Purpose

- Provide concise, authoritative context for documentation-system refactor tasks.
- Keep docs refactor prompts grounded in canonical contracts for placement, metadata, migration safety, and validation.

## When To Use

- Editing docs-system assets in `docs/context`, `docs/architecture`, or `docs/contributors`.
- Updating documentation taxonomy/metadata contracts and router guidance.
- Planning or implementing documentation migration/refactor slices with guardrail alignment.
- Decomposing docs-refactor requests into deterministic implementation/test/doc updates.

## When Not To Use

- Runtime code implementation work where docs updates are secondary.
- Operational incident/runbook tasks.
- Domain-specific architecture implementation tasks with no docs-system contract changes.

## Invariants

- Keep `.md` and `.ai.md` companion docs synchronized.
- Maintain one authoritative owner per responsibility; link secondary references instead of duplicating authority.
- Keep metadata fields and taxonomy enum values contract-aligned.
- Treat baseline, transitional, and superseded docs as opt-in historical context only.
- Prefer active canonical routers/contracts by default; include historical evidence only when an outcome explicitly requires it.
- Keep routers/overviews concise and link-first.

## Authoritative Docs

- `docs/architecture/README.ai.md`
- `docs/contributors/docs-placement-guide.ai.md`
- `docs/contributors/docs-migration-safety-guide.ai.md`
- `docs/contributors/docs-foundation-validation.ai.md`
- `docs/contributors/router-overview-writing-standard.ai.md`
- `docs/context/documentation-taxonomy.ai.md`
- `docs/context/documentation-metadata-header.ai.md`
- `docs/context/documentation-status-signals.ai.md`
- `docs/context/documentation-baseline-and-historical-folder-strategy.ai.md`
- `docs/context/documentation-supersession-and-redirect-conventions.ai.md`
- `docs/context/prompt-routing.ai.md`

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

- Duplicating long-form canonical docs inside pack content.
- Refactoring docs without updating metadata lifecycle and pointer notes.
- Leaving parallel canonical docs after split/move operations.
- Using archived migration baseline content as active canonical guidance.
- Pulling in `docs/baselines/` or superseded pointer stubs by default when active canonical sources already cover the task.
- Turning routers into procedural implementation guides.

## Related Packs

- `repository-overview`: first-tier orientation before docs-system specifics.
- `architecture-core`: add when docs work touches architecture boundary contracts.
- `context-system-foundations`: add when docs refactor work updates context contracts/routing/governance assets.

## Retrieval Order

1. `docs/context/packs/repository-overview.pack.ai.md`
2. `docs/context/packs/architecture-core.pack.ai.md`
3. `docs/context/packs/documentation-refactor.pack.ai.md`
4. `docs/contributors/docs-placement-guide.ai.md`
5. `docs/contributors/docs-migration-safety-guide.ai.md`
6. `docs/contributors/router-overview-writing-standard.ai.md`

## Change Triggers

- Taxonomy or metadata contract updates for documentation headers.
- Router/overview writing-standard updates.
- Docs foundation validator or docs guardrail test updates.
- Renamed or newly canonical docs-system references used by this pack.
