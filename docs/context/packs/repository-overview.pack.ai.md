# AI Companion: Repository Overview Pack

## Purpose

- First-tier orientation for AI Loom Studio tasks: repository mission, high-level layout, and durable architecture themes.
- Help assistants choose correct canonical docs/code surfaces before loading deeper domain context.
- Reinforce repo-wide anti-drift guardrails that apply across all domains without replacing domain-pack detail.

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
- Prefer small, targeted deltas over broad refactors unless requested outcomes explicitly require restructuring.
- Read nearby code/docs before editing so implementations match local conventions and domain language.
- Reuse existing utilities/components/services/patterns before creating new abstractions or surfaces.
- Protect boundary integrity: avoid erosion of transport, runtime, domain, and composition seams.
- Keep responsibilities intentionally distributed; avoid growth of single-file or single-surface "god objects."
- Keep explicit contracts/guardrails enforceable in docs, schemas, and tests; avoid bypass paths.
- Avoid speculative features, hidden scope, or placeholder logic unless explicitly requested.
- For behavior changes, verify whether tests, docs, types, and examples also need updates.
- Keep cross-cutting concerns (security, observability, policy, persistence discipline) in designated layers, not outer convenience paths.
- Prefer production-safe defaults and profile clarity over convenience shortcuts that weaken deployment discipline.

## Authoritative Docs

- `README.md`
- `docs/adr/records/adr-001-single-authoritative-control-plane.ai.md`
- `docs/adr/records/adr-002-workspace-centered-tenancy-and-resource-ownership.ai.md`
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
- Allowing boundary erosion via direct cross-layer calls, ad hoc adapters, or undocumented shortcuts.
- Accumulating orchestration, policy, persistence, and transport logic into one file/surface for convenience.
- Bypassing explicit contracts (typed interfaces, schema validation, routing contracts, startup composition constraints).
- Letting observability, secrets/trust handling, or policy enforcement leak into UI/outer transport entry points.
- Accepting default dev-mode behavior as production-safe without explicit profile governance.
- Growing broad surfaces without corresponding architectural guardrails/tests, increasing cognitive load and drift risk.
- Writing tests that assert internals instead of contract-level or user-visible behavior.
- Reporting verification as complete without clearly stating what was checked, what was not checked, and why.
- Ending work without a short self-review covering completed work, architecture alignment, and remaining risks.

## Related Packs

- `context-system-foundations`: combine when editing context contracts, routing assets, governance docs, or metadata seeds.
- `runtime-and-host`: prefer for runtime, desktop, host startup, and lifecycle diagnostics/implementation work.
- Use architecture canonical docs and ADRs for deep authority (`docs/architecture/README.ai.md`, `docs/adr/README.ai.md`).
- Follow-on context-pack needs (create as separate domain packs, not here):
  - transport and API boundary discipline
  - control-plane composition and startup assembly discipline
  - security material and trust hardening
  - persistence and migration governance
  - observability and readiness diagnostics
  - development-mode and deployment-profile governance

## Retrieval Order

1. `docs/context/packs/repository-overview.pack.ai.md`
2. `docs/context/routing/task-to-context-routing.seed.json`
3. `docs/architecture/README.ai.md`
4. Domain-specific pack(s) selected by task category and changed paths.

## Change Triggers

- Top-level repository structure or host/runtime composition changes.
- Canonical architecture router changes that alter orientation links.
- Routing contract/profile updates that change first-tier context assembly behavior.
