---
title: ADR-004 Studios as Views Over Shared System and Asset Model
doc_type: adr
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
adr_number: 004
decision_status: accepted
decision_date: 2026-04-11
review_tier: routine
last_reviewed: 2026-04-11
related_code_paths:
  - src/domain/studio-shell/StudioShellDomain.ts
  - src/application/studio-shell/DefaultStudioShellApplicationService.ts
  - src/application/studio-entry/ContextualStudioInitializer.ts
  - src/application/studio-handoff/StudioHandoffOrchestrationService.ts
  - src/application/studio-handoff/SystemStudioHandoffIntegrationService.ts
  - src/domain/system-studio/SystemAssetDomain.ts
  - src/ui/routes/StudioHandoffContract.ts
  - src/ui/pages/StudioShellPage.tsx
  - src/ui/studio-shell/StudioShellExtensions.ts
---

# ADR-004: Studios as Views Over Shared System and Asset Model

## Status

accepted

## Decision Date

2026-04-11

## Decision Statement

AI Loom Studio treats studios as bounded authoring and interaction views over one shared underlying system and asset model, not as disconnected tools with independent truth models. Studio-specific UX modes may shape presentation, flow, and focus, but they must read and write through shared domain/application contracts for assets, workflows, systems, and cross-studio handoff semantics. Studio implementations must preserve canonical identity, lifecycle, lineage, and compatibility semantics across all studio surfaces.

## Context and Problem Statement

The repository now includes multiple studio surfaces (workflow, system, data, registry-linked selectors, and cross-studio create/select/return flows) that operate on overlapping entities and relationships. Without an explicit architecture decision, feature work can drift toward studio-local state models, duplicative contracts, and route-local orchestration assumptions that fragment system truth and force repeated reconciliation logic.

This ADR establishes decision memory that studios are composition views over shared platform models. The goal is to keep architectural intent durable for contributors and AI-assisted implementation so new studio capabilities extend shared seams rather than forking architecture by UI surface.

## Decision Drivers

- Preserve one authoritative system/asset model across studio surfaces.
- Prevent drift caused by studio-local contract variants and duplicate lifecycle semantics.
- Keep cross-studio handoff, return, and reopen behavior consistent and inspectable.
- Maintain clear domain/application authority boundaries while allowing studio-specific UX composition.
- Improve extensibility so new studios can be added without inventing parallel persistence, identity, or compatibility models.

## Considered Options

1. Studios as views/modes over a shared system and asset model (accepted): preserves one contract authority for identity, lifecycle, lineage, compatibility, and cross-studio orchestration while still allowing studio-specific UX behavior.
2. Studios as disconnected tools with studio-local models (rejected): allows fast local iteration but creates conflicting truth models, brittle handoff behavior, duplicated validation logic, and high migration/reconciliation cost.
3. Hybrid approach with partial shared contracts and optional studio-local model forks (rejected): reduces initial migration pressure but leaves long-term ambiguity about which model is authoritative and encourages architecture drift.
4. Single monolithic studio with no bounded modes (rejected): centralizes model truth but collapses UX clarity and workflow ergonomics by forcing all authoring behavior into one surface rather than bounded, task-focused views.

## Chosen Approach

Studios are implemented as bounded composition surfaces (routes/pages/modes) that project and orchestrate shared domain/application contracts. Studio shell registration, selector contracts, and handoff contracts are the composition seams that keep per-studio UX differentiated while preserving one underlying model for systems and assets.

Workflow and system authoring remain distinct interaction contexts, but their saved definitions, compatibility checks, identity references, and lifecycle posture continue to flow through shared model contracts rather than studio-local payload formats. Cross-studio launch/return paths must carry canonical handoff context and resolve back into shared model references, not ad hoc route-local state reconstruction.

## Consequences

- UI composition: studio pages focus on presentation, mode orchestration, and guided interaction while shared services/contracts own durable model semantics.
- Workflow integration: workflow authoring, selector attachment, and return handling remain aligned to shared references so cross-studio transitions do not fork workflow truth.
- System modeling: system assets remain first-class model entities with stable identity, lifecycle, and lineage semantics independent of which studio surface last edited them.
- Extensibility: new studio types can be added as additional views by registering composition behavior and reusing shared contracts instead of creating parallel model stacks.
- Tradeoff: studio teams must work through shared contracts and may need to evolve common seams before shipping studio-local UX behavior.
- Risk: legacy flows that still rely on studio-local assumptions require targeted refactoring to align with shared model boundaries.

## Related Documentation

- `docs/adr/records/adr-001-single-authoritative-control-plane.md`
- `docs/adr/records/adr-002-workspace-centered-tenancy-and-resource-ownership.md`
- `docs/architecture/studio-handoff-contract.md`
- `docs/architecture/shared-composition-taxonomy.md`
- `docs/architecture/image-workflow-system-definition-layer.md`
- `docs/architecture/image-system-domain-foundation.md`
- `docs/architecture/asset-selector-framework.md`
- `docs/context/packs/studio-and-system-composition.pack.md`
- `docs/context/context-map.md`

## Related Code Paths

- `src/domain/studio-shell/StudioShellDomain.ts`
- `src/application/studio-shell/DefaultStudioShellApplicationService.ts`
- `src/application/studio-entry/ContextualStudioInitializer.ts`
- `src/application/studio-handoff/StudioHandoffOrchestrationService.ts`
- `src/application/studio-handoff/SystemStudioHandoffIntegrationService.ts`
- `src/domain/system-studio/SystemAssetDomain.ts`
- `src/ui/routes/StudioHandoffContract.ts`
- `src/ui/routes/StudioReturnPayloadResolution.ts`
- `src/ui/pages/StudioShellPage.tsx`
- `src/ui/studio-shell/StudioShellExtensions.ts`
- `src/ui/studio-shell/asset-selector/AssetSelectorStudioLaunchService.ts`

## Follow-Up Actions

- Use this ADR as a review gate when studio features introduce new model payloads, lifecycle fields, or identity semantics outside shared contracts.
- Keep studio/system architecture docs linked back to this ADR under `## Related ADRs`.
- Track legacy studio-local state assumptions and migrate them toward shared model and handoff seams.
