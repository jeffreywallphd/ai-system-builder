# AI Companion: Repository Overview Pack

## Purpose

- First-tier orientation for AI Loom Studio tasks: repository mission, high-level layout, and durable architecture themes.
- Help assistants choose correct canonical docs/code surfaces before loading deeper domain context.

## When To Use

- Starting work in unfamiliar repository areas.
- Tasks spanning multiple domains (`src/hosts`, `src/application`, `src/domain`, `docs/architecture`, `docs/context`).
- Early routing for decomposition, implementation planning, architecture review, and cross-domain docs changes.

## When Not To Use

- Deep domain execution where a dedicated domain pack should lead.
- Operational runbook incidents requiring procedure-level docs.
- Replacing canonical architecture contracts with summary text.

## Invariants

- Product shape is domain-first workflow studio with desktop-host-first development truth.
- Preserve layered direction: domain -> application -> infrastructure/hosts/ui integration.
- Canonical authority remains in referenced docs/contracts/tests; this pack is orientation only.
- Keep context minimal: use this pack first, then route into domain-specific assets.

## Authoritative Docs

- `README.md`
- `docs/architecture/README.ai.md`
- `docs/architecture/domain-and-application-core.md`
- `docs/architecture/layers-and-boundaries.md`
- `docs/architecture/workflow-execution-and-tools.md`
- `docs/context/prompt-routing.ai.md`
- `docs/context/context-map.ai.md`

## Authoritative Code Paths

- `src/domain`
- `src/application`
- `src/infrastructure`
- `src/hosts`
- `src/ui`
- `electron/main`
- `dev/tests/HostCompositionArchitectureGuardrails.test.ts`
- `dev/tests/TaskToContextRoutingContractGuardrails.test.ts`

## Anti-Patterns

- Using this pack as an all-in-one replacement for domain packs and canonical architecture docs.
- Loading broad unrelated context instead of routing by `taskCategory` and `changedPaths`.
- Breaking layer boundaries by mixing host/infrastructure concerns into domain logic.
- Assuming browser fallback behavior is the primary runtime truth when desktop-host contracts apply.

## Related Packs

- `context-system-foundations`: combine when editing context contracts, routing assets, governance docs, or metadata seeds.
- Future domain packs: switch to those for deep behavior details once routing selects them.

## Retrieval Order

1. `docs/context/packs/repository-overview.pack.ai.md`
2. `docs/context/routing/task-to-context-routing.seed.json`
3. `docs/architecture/README.ai.md`
4. Domain-specific pack(s) selected by task category and changed paths.

## Change Triggers

- Top-level repository structure or host/runtime composition changes.
- Canonical architecture router changes that alter orientation links.
- Routing contract/profile updates that change first-tier context assembly behavior.
