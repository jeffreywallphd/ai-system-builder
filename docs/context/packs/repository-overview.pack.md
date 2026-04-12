# Repository Overview Pack

## Purpose

- Provide first-tier orientation for AI Loom Studio tasks: what the product is, where major repository domains live, and which architecture themes must shape decisions.
- Help contributors select the right authoritative docs and code surfaces quickly before loading domain-specific packs.
- Reinforce repo-wide anti-drift guardrails that apply across domains without replacing domain-pack detail.

## When To Use

- Starting work in unfamiliar areas of this repository.
- Triaging prompts that touch multiple domains (`src/hosts`, `src/application`, `src/domain`, `docs/architecture`, `docs/context`).
- Performing feature decomposition, implementation planning, architecture review, or cross-domain documentation updates.

## When Not To Use

- Deep domain execution where a dedicated domain pack should be primary (for example security, storage, run orchestration, or UI-only contract details).
- Runbook-style operational troubleshooting with incident-specific procedures.
- Replacing canonical architecture references with this summary.

## Invariants

- AI Loom Studio is a domain-first desktop + web workflow studio; development truth is desktop-host-first, not browser-fallback-first.
- Repository changes must preserve layered boundaries (domain -> application -> infrastructure/hosts/ui integration).
- Authoritative behavior comes from canonical docs/contracts and tests; this pack is orientation only.
- Prefer minimum sufficient context: load this pack first, then add mapped domain sources.
- Protect boundary integrity; do not erode transport, runtime, domain, and composition seams.
- Keep responsibilities intentionally distributed; avoid single-file or single-surface responsibility accumulation.
- Maintain explicit contracts and guardrails (docs, schemas, tests); avoid bypasses.
- Keep cross-cutting concerns (security, observability, policy, persistence discipline) in designated layers.
- Prefer production-safe defaults and explicit profile governance over convenience shortcuts.

## Authoritative Docs

- `README.md`
- `docs/adr/records/adr-001-single-authoritative-control-plane.md`
- `docs/adr/records/adr-002-workspace-centered-tenancy-and-resource-ownership.md`
- `docs/architecture/README.md`
- `docs/architecture/domain-and-application-core.md`
- `docs/architecture/layers-and-boundaries.md`
- `docs/architecture/workflow-execution-and-tools.md`
- `docs/context/prompt-routing.md`
- `docs/context/context-map.md`

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

- Treating this pack as a substitute for feature/domain packs or canonical architecture references.
- Pulling unrelated docs/code "just in case" instead of routing by `changedPaths` and task category.
- Violating layer boundaries by introducing host/infrastructure concerns directly into domain logic.
- Assuming browser-only development behavior is authoritative when desktop-host contracts apply.
- Allowing boundary erosion through direct cross-layer calls, ad hoc adapters, or undocumented shortcuts.
- Concentrating orchestration, policy, persistence, and transport behavior into one convenience surface.
- Bypassing explicit contracts (typed boundaries, schema validation, routing contracts, startup composition constraints).
- Letting observability, trust material, or policy checks leak into outer UI/transport entry points.
- Treating development-mode defaults as production-ready without explicit deployment profile constraints.
- Expanding oversized surfaces without matching architectural guardrails/tests, increasing cognitive-load and drift risk.

## Related Packs

- `context-system-foundations`: use with this pack when changing context contracts, routing maps, governance assets, or pack metadata.
- `runtime-and-host`: prefer for runtime, desktop, host startup, and lifecycle implementation or diagnostics tasks.
- Use canonical architecture docs and ADRs for deep authority (`docs/architecture/README.md`, `docs/adr/README.md`).
- Follow-on context-pack needs (to be authored separately, not expanded here):
  - transport and API boundary discipline
  - control-plane composition and startup assembly discipline
  - security material and trust hardening
  - persistence and migration governance
  - observability and readiness diagnostics
  - development-mode and deployment-profile governance

## Retrieval Order

1. `docs/context/packs/repository-overview.pack.md`
2. `docs/context/routing/task-to-context-routing.seed.json`
3. `docs/architecture/README.md`
4. Domain-specific pack(s) selected by task category and changed paths.

## Change Triggers

- Major repository structure changes (top-level folders, host/runtime composition boundaries, or persistence strategy shifts).
- Canonical architecture router changes that alter "start here" references.
- Routing contract updates that change first-tier context assembly expectations.
