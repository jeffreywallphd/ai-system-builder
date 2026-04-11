# AI Companion: Core Architecture Pack

## Purpose

- Compact architecture-first context for tasks where boundary correctness is a primary risk.
- Keep implementation and design decisions anchored to canonical architecture contracts without broad doc overloading.

## When To Use

- Architecture review, migration/refactor, and cross-layer implementation tasks.
- Work touching host composition, startup boundaries, or transport-to-application seams.
- Decomposition tasks that require architecture-safe story slicing.

## When Not To Use

- Context-engineering contract edits where `context-system-foundations` is primary.
- Narrow single-domain tasks already covered by a dedicated domain pack.
- Runbook/incident procedure tasks.

## Invariants

- Preserve direction: `domain -> application -> infrastructure/hosts/ui integration`.
- Keep business policy in domain/application; keep outer layers thin and adapter-oriented.
- Authoritative server host is the control-plane authority; desktop/worker hosts are non-authoritative.
- Keep architecture docs and guardrail tests aligned when boundary behavior changes.
- Reuse/extend existing ports before creating parallel runtime or persistence seams.

## Authoritative Docs

- `docs/architecture/README.ai.md`
- `docs/adr/records/adr-001-single-authoritative-control-plane.ai.md`
- `docs/adr/records/adr-003-storage-as-managed-platform-resource.ai.md`
- `docs/adr/records/adr-004-studios-as-views-over-shared-system-and-asset-model.ai.md`
- `docs/architecture/domain-and-application-core.ai.md`
- `docs/architecture/layers-and-boundaries.ai.md`
- `docs/architecture/workflow-execution-and-tools.ai.md`
- `docs/architecture/desktop-host-assembly.ai.md`
- `docs/architecture/authoritative-server-host-assembly.ai.md`
- `docs/architecture/worker-host-assembly.ai.md`
- `docs/architecture/studio-handoff-contract.ai.md`

## Authoritative Code Paths

- `src/domain`
- `src/application`
- `src/infrastructure`
- `src/hosts`
- `src/ui/routes/StudioHandoffContract.ts`
- `dev/tests/HostCompositionArchitectureGuardrails.test.ts`
- `dev/tests/ArchitectureDocsRoutingIntegrity.test.ts`

## Anti-Patterns

- Putting domain/application policy in UI services, entrypoints, or transport handlers.
- Bypassing application ports with direct infrastructure calls from outer layers.
- Treating historical direction notes as canonical architecture contracts when router docs differ.
- Adding duplicate runtime/persistence pathways outside host composition seams.

## Related Packs

- `repository-overview`: load first for broad repository orientation.
- `runtime-and-host`: combine for host/runtime startup, lifecycle, and desktop boundary focused architecture tasks.
- `context-system-foundations`: combine when architecture tasks also change context contracts/routing/governance.

## Retrieval Order

1. `docs/context/packs/architecture-core.pack.ai.md`
2. `docs/architecture/README.ai.md`
3. `docs/architecture/layers-and-boundaries.ai.md`
4. Task-matched architecture docs from host assembly, workflow execution, and studio handoff.

## Change Triggers

- Layer-boundary contract updates in core architecture docs.
- Host authority/startup composition contract updates in host assembly docs.
- Architecture router updates that change canonical references.
- Architecture guardrail test updates that change expected boundaries.
